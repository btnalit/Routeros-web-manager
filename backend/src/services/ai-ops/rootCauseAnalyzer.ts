/**
 * RootCauseAnalyzer 根因分析服务
 * 分析告警的根本原因和关联关系
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 * - 6.1: 分析单个告警的潜在根因
 * - 6.2: 在关联窗口内分析多个告警以识别共同根因
 * - 6.3: 识别共同根因时将所有相关告警链接到根因事件
 * - 6.4: 生成事件时间线显示事件序列
 * - 6.5: 评估影响范围（用户、服务、网段）
 * - 6.6: 为每个识别的根因提供置信度评分 (0-100)
 * - 6.7: 引用相似的历史事件
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  UnifiedEvent,
  RootCause,
  EventTimeline,
  TimelineEvent,
  ImpactAssessment,
  ImpactScope,
  SimilarIncident,
  RootCauseAnalysis,
  IRootCauseAnalyzer,
  AlertSeverity,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { aiAnalyzer } from './aiAnalyzer';
import { routerosClient } from '../routerosClient';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis');

// Default correlation window: 5 minutes
const DEFAULT_CORRELATION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Get date string (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * Get analysis file path for a date
 */
function getAnalysisFilePath(dateStr: string): string {
  return path.join(ANALYSIS_DIR, `${dateStr}.json`);
}


/**
 * Root cause patterns for common issues
 */
const ROOT_CAUSE_PATTERNS: Array<{
  id: string;
  name: string;
  pattern: RegExp;
  category: string;
  description: string;
  baseConfidence: number;
}> = [
  {
    id: 'high-cpu',
    name: 'High CPU Usage',
    pattern: /cpu|processor|load/i,
    category: 'system',
    description: 'High CPU usage may indicate resource-intensive processes or insufficient hardware',
    baseConfidence: 75,
  },
  {
    id: 'memory-exhaustion',
    name: 'Memory Exhaustion',
    pattern: /memory|ram|out of memory|oom/i,
    category: 'system',
    description: 'Memory exhaustion can cause system instability and service failures',
    baseConfidence: 80,
  },
  {
    id: 'disk-full',
    name: 'Disk Space Full',
    pattern: /disk|storage|space|full/i,
    category: 'system',
    description: 'Insufficient disk space can prevent logging and cause service failures',
    baseConfidence: 85,
  },
  {
    id: 'interface-down',
    name: 'Interface Down',
    pattern: /interface.*down|link.*down|disconnected|断开/i,
    category: 'interface',
    description: 'Network interface failure may indicate cable issues, hardware failure, or configuration problems',
    baseConfidence: 70,
  },
  {
    id: 'interface-flapping',
    name: 'Interface Flapping',
    pattern: /flapping|状态变化|state change/i,
    category: 'interface',
    description: 'Interface flapping indicates unstable network connection, possibly due to cable or hardware issues',
    baseConfidence: 75,
  },
  {
    id: 'auth-failure',
    name: 'Authentication Failure',
    pattern: /auth|login.*fail|password|credential|认证/i,
    category: 'security',
    description: 'Authentication failures may indicate brute force attacks or misconfigured credentials',
    baseConfidence: 70,
  },
  {
    id: 'firewall-block',
    name: 'Firewall Block',
    pattern: /firewall|block|drop|reject|deny/i,
    category: 'security',
    description: 'Firewall blocking traffic may indicate security threats or misconfigured rules',
    baseConfidence: 65,
  },
  {
    id: 'connection-timeout',
    name: 'Connection Timeout',
    pattern: /timeout|connection.*lost|unreachable/i,
    category: 'network',
    description: 'Connection timeouts may indicate network congestion, routing issues, or remote host problems',
    baseConfidence: 60,
  },
  {
    id: 'traffic-spike',
    name: 'Traffic Spike',
    pattern: /traffic|bandwidth|throughput|流量/i,
    category: 'network',
    description: 'Unusual traffic patterns may indicate DDoS attacks, misconfiguration, or legitimate high usage',
    baseConfidence: 65,
  },
];


export class RootCauseAnalyzer implements IRootCauseAnalyzer {
  private initialized = false;
  private analysisCache: Map<string, RootCauseAnalysis> = new Map();

  /**
   * Ensure data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(ANALYSIS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create analysis directory:', error);
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.ensureDataDir();
    this.initialized = true;
    logger.info('RootCauseAnalyzer initialized');
  }

  /**
   * Read analysis file for a date
   */
  private async readAnalysisFile(dateStr: string): Promise<RootCauseAnalysis[]> {
    const filePath = getAnalysisFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as RootCauseAnalysis[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read analysis file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * Write analysis file for a date
   */
  private async writeAnalysisFile(dateStr: string, analyses: RootCauseAnalysis[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = getAnalysisFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(analyses, null, 2), 'utf-8');
  }

  /**
   * Save analysis result
   */
  private async saveAnalysis(analysis: RootCauseAnalysis): Promise<void> {
    const dateStr = getDateString(analysis.timestamp);
    const analyses = await this.readAnalysisFile(dateStr);
    
    const existingIndex = analyses.findIndex((a) => a.id === analysis.id);
    if (existingIndex >= 0) {
      analyses[existingIndex] = analysis;
    } else {
      analyses.push(analysis);
    }
    
    await this.writeAnalysisFile(dateStr, analyses);
    this.analysisCache.set(analysis.id, analysis);
  }


  /**
   * Analyze a single event for root causes
   * Requirements: 6.1, 6.6
   */
  async analyzeSingle(event: UnifiedEvent): Promise<RootCauseAnalysis> {
    await this.initialize();

    const now = Date.now();
    const analysisId = uuidv4();

    // Step 1: Pattern-based root cause identification
    const patternRootCauses = this.identifyRootCausesByPattern(event);

    // Step 2: Try AI-enhanced analysis
    let aiRootCauses: RootCause[] = [];
    try {
      aiRootCauses = await this.getAIRootCauses(event);
    } catch (error) {
      logger.warn('AI root cause analysis failed, using pattern-based only:', error);
    }

    // Step 3: Merge and deduplicate root causes
    const rootCauses = this.mergeRootCauses(patternRootCauses, aiRootCauses, [event.id]);

    // Step 4: Generate timeline (single event)
    const timeline = this.generateTimeline([event]);

    // Step 5: Assess impact
    const impact = await this.assessImpact(event, rootCauses);

    // Step 6: Find similar incidents
    const similarIncidents = await this.findSimilarIncidents(event);

    const analysis: RootCauseAnalysis = {
      id: analysisId,
      alertId: event.id,
      timestamp: now,
      rootCauses,
      timeline,
      impact,
      similarIncidents: similarIncidents.length > 0 ? similarIncidents : undefined,
    };

    // Save analysis
    await this.saveAnalysis(analysis);

    logger.info(`Root cause analysis completed for event ${event.id}: ${rootCauses.length} root causes identified`);
    return analysis;
  }

  /**
   * Analyze correlated events for common root causes
   * Requirements: 6.2, 6.3
   */
  async analyzeCorrelated(
    events: UnifiedEvent[],
    windowMs: number = DEFAULT_CORRELATION_WINDOW_MS
  ): Promise<RootCauseAnalysis> {
    await this.initialize();

    if (events.length === 0) {
      throw new Error('No events provided for correlation analysis');
    }

    if (events.length === 1) {
      return this.analyzeSingle(events[0]);
    }

    const now = Date.now();
    const analysisId = uuidv4();
    const primaryEvent = events[0]; // Use first event as primary

    // Filter events within correlation window
    const correlatedEvents = this.filterEventsInWindow(events, windowMs);
    const eventIds = correlatedEvents.map((e) => e.id);

    // Step 1: Pattern-based root cause identification for all events
    const allPatternCauses: RootCause[] = [];
    for (const event of correlatedEvents) {
      const causes = this.identifyRootCausesByPattern(event);
      allPatternCauses.push(...causes);
    }

    // Step 2: Try AI correlation analysis
    let aiRootCauses: RootCause[] = [];
    try {
      aiRootCauses = await this.getAICorrelatedRootCauses(correlatedEvents);
    } catch (error) {
      logger.warn('AI correlation analysis failed, using pattern-based only:', error);
    }

    // Step 3: Merge and identify common root causes
    const rootCauses = this.mergeRootCauses(allPatternCauses, aiRootCauses, eventIds);

    // Step 4: Generate timeline for all events
    const timeline = this.generateTimeline(correlatedEvents);

    // Step 5: Assess combined impact
    const impact = await this.assessCombinedImpact(correlatedEvents, rootCauses);

    // Step 6: Find similar incidents
    const similarIncidents = await this.findSimilarIncidents(primaryEvent);

    const analysis: RootCauseAnalysis = {
      id: analysisId,
      alertId: primaryEvent.id,
      timestamp: now,
      rootCauses,
      timeline,
      impact,
      similarIncidents: similarIncidents.length > 0 ? similarIncidents : undefined,
    };

    // Save analysis
    await this.saveAnalysis(analysis);

    logger.info(
      `Correlated root cause analysis completed: ${correlatedEvents.length} events, ${rootCauses.length} root causes`
    );
    return analysis;
  }


  /**
   * Generate event timeline
   * Requirements: 6.4
   */
  generateTimeline(events: UnifiedEvent[]): EventTimeline {
    if (events.length === 0) {
      return {
        events: [],
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }

    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    const timelineEvents: TimelineEvent[] = sortedEvents.map((event, index) => {
      // Determine event type based on position and content
      let type: TimelineEvent['type'] = 'symptom';
      
      if (index === 0) {
        // First event is likely the trigger or cause
        type = this.isLikelyCause(event) ? 'cause' : 'trigger';
      } else if (this.isLikelyCause(event)) {
        type = 'cause';
      } else if (this.isLikelyEffect(event)) {
        type = 'effect';
      }

      return {
        timestamp: event.timestamp,
        eventId: event.id,
        description: this.buildTimelineDescription(event),
        type,
      };
    });

    return {
      events: timelineEvents,
      startTime: sortedEvents[0].timestamp,
      endTime: sortedEvents[sortedEvents.length - 1].timestamp,
    };
  }

  /**
   * Assess impact of an event
   * Requirements: 6.5
   */
  async assessImpact(event: UnifiedEvent, rootCauses: RootCause[]): Promise<ImpactAssessment> {
    const affectedResources = this.extractAffectedResources(event);
    const scope = this.determineImpactScope(event, rootCauses);
    const services = this.identifyAffectedServices(event);
    const networkSegments = this.identifyNetworkSegments(event);
    const estimatedUsers = this.estimateAffectedUsers(scope, affectedResources);

    return {
      scope,
      affectedResources,
      estimatedUsers,
      services,
      networkSegments,
    };
  }

  /**
   * Assess combined impact of multiple events
   */
  private async assessCombinedImpact(
    events: UnifiedEvent[],
    rootCauses: RootCause[]
  ): Promise<ImpactAssessment> {
    const allResources = new Set<string>();
    const allServices = new Set<string>();
    const allSegments = new Set<string>();

    for (const event of events) {
      const resources = this.extractAffectedResources(event);
      resources.forEach((r) => allResources.add(r));

      const services = this.identifyAffectedServices(event);
      services.forEach((s) => allServices.add(s));

      const segments = this.identifyNetworkSegments(event);
      segments.forEach((s) => allSegments.add(s));
    }

    // Determine overall scope based on number of affected resources
    let scope: ImpactScope = 'local';
    if (allResources.size > 5 || events.length > 5) {
      scope = 'widespread';
    } else if (allResources.size > 2 || events.length > 2) {
      scope = 'partial';
    }

    // Escalate scope based on severity
    const hasCritical = events.some((e) => e.severity === 'critical' || e.severity === 'emergency');
    if (hasCritical && scope === 'local') {
      scope = 'partial';
    }

    const estimatedUsers = this.estimateAffectedUsers(scope, Array.from(allResources));

    return {
      scope,
      affectedResources: Array.from(allResources),
      estimatedUsers,
      services: Array.from(allServices),
      networkSegments: Array.from(allSegments),
    };
  }


  /**
   * Find similar historical incidents
   * Requirements: 6.7
   */
  async findSimilarIncidents(event: UnifiedEvent, limit: number = 5): Promise<SimilarIncident[]> {
    await this.initialize();

    const similarIncidents: SimilarIncident[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get date range for searching
    const dates = this.getDateRange(thirtyDaysAgo, now);

    for (const dateStr of dates) {
      try {
        const analyses = await this.readAnalysisFile(dateStr);
        
        for (const analysis of analyses) {
          // Skip self
          if (analysis.alertId === event.id) continue;

          // Calculate similarity
          const similarity = this.calculateSimilarity(event, analysis);
          
          if (similarity > 0.3) { // Minimum 30% similarity threshold
            similarIncidents.push({
              id: analysis.id,
              timestamp: analysis.timestamp,
              similarity: Math.round(similarity * 100) / 100,
              resolution: this.extractResolution(analysis),
            });
          }
        }
      } catch (error) {
        logger.debug(`Failed to read analysis file for ${dateStr}:`, error);
      }
    }

    // Sort by similarity (descending) and limit results
    return similarIncidents
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==================== Helper Methods ====================

  /**
   * Identify root causes by pattern matching
   */
  private identifyRootCausesByPattern(event: UnifiedEvent): RootCause[] {
    const rootCauses: RootCause[] = [];

    for (const pattern of ROOT_CAUSE_PATTERNS) {
      if (pattern.pattern.test(event.message) || pattern.pattern.test(event.category)) {
        // Adjust confidence based on severity
        let confidence = pattern.baseConfidence;
        if (event.severity === 'critical' || event.severity === 'emergency') {
          confidence = Math.min(100, confidence + 10);
        } else if (event.severity === 'info') {
          confidence = Math.max(0, confidence - 15);
        }

        rootCauses.push({
          id: `${pattern.id}-${uuidv4().slice(0, 8)}`,
          description: pattern.description,
          confidence,
          evidence: [event.message],
          relatedAlerts: [event.id],
        });
      }
    }

    // If no patterns matched, create a generic root cause
    if (rootCauses.length === 0) {
      rootCauses.push({
        id: `unknown-${uuidv4().slice(0, 8)}`,
        description: `Unknown issue in ${event.category}: ${event.message}`,
        confidence: 40,
        evidence: [event.message],
        relatedAlerts: [event.id],
      });
    }

    return rootCauses;
  }

  /**
   * Get AI-enhanced root causes for a single event
   */
  private async getAIRootCauses(event: UnifiedEvent): Promise<RootCause[]> {
    try {
      const result = await aiAnalyzer.analyze({
        type: 'alert',
        context: {
          alertEvent: {
            id: event.id,
            ruleId: event.alertRuleInfo?.ruleId || 'unknown',
            ruleName: event.alertRuleInfo?.ruleName || event.category,
            severity: event.severity,
            metric: event.alertRuleInfo?.metric || event.category,
            currentValue: event.alertRuleInfo?.currentValue || 0,
            threshold: event.alertRuleInfo?.threshold || 0,
            message: event.message,
            status: 'active',
            triggeredAt: event.timestamp,
          },
          systemMetrics: {
            cpu: { usage: 0 },
            memory: { total: 0, used: 0, free: 0, usage: 0 },
            disk: { total: 0, used: 0, free: 0, usage: 0 },
            uptime: 0,
          },
          analysisType: 'root_cause',
        },
      });

      // Convert AI analysis to root cause format
      const confidence = result.confidence || 70;
      return [{
        id: `ai-${uuidv4().slice(0, 8)}`,
        description: result.summary,
        confidence: Math.min(100, Math.max(0, confidence * 100)),
        evidence: result.recommendations || [],
        relatedAlerts: [event.id],
      }];
    } catch (error) {
      logger.debug('AI root cause analysis failed:', error);
      return [];
    }
  }


  /**
   * Get AI-enhanced root causes for correlated events
   */
  private async getAICorrelatedRootCauses(events: UnifiedEvent[]): Promise<RootCause[]> {
    try {
      // Build context with all events
      const eventSummaries = events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        severity: e.severity,
        category: e.category,
        message: e.message,
      }));

      const result = await aiAnalyzer.analyze({
        type: 'alert',
        context: {
          alertEvent: {
            id: events[0].id,
            ruleId: events[0].alertRuleInfo?.ruleId || 'correlation',
            ruleName: 'Correlated Events Analysis',
            severity: this.getHighestSeverity(events),
            metric: 'correlation',
            currentValue: events.length,
            threshold: 1,
            message: `Analyzing ${events.length} correlated events`,
            status: 'active',
            triggeredAt: events[0].timestamp,
          },
          systemMetrics: {
            cpu: { usage: 0 },
            memory: { total: 0, used: 0, free: 0, usage: 0 },
            disk: { total: 0, used: 0, free: 0, usage: 0 },
            uptime: 0,
          },
          correlatedEvents: eventSummaries,
          analysisType: 'correlation',
        },
      });

      const confidence = result.confidence || 65;
      return [{
        id: `ai-corr-${uuidv4().slice(0, 8)}`,
        description: result.summary,
        confidence: Math.min(100, Math.max(0, confidence * 100)),
        evidence: result.recommendations || [],
        relatedAlerts: events.map((e) => e.id),
      }];
    } catch (error) {
      logger.debug('AI correlation analysis failed:', error);
      return [];
    }
  }

  /**
   * Merge and deduplicate root causes
   */
  private mergeRootCauses(
    patternCauses: RootCause[],
    aiCauses: RootCause[],
    eventIds: string[]
  ): RootCause[] {
    const merged: RootCause[] = [];
    const seenDescriptions = new Set<string>();

    // Add pattern-based causes first
    for (const cause of patternCauses) {
      const normalizedDesc = cause.description.toLowerCase().trim();
      if (!seenDescriptions.has(normalizedDesc)) {
        seenDescriptions.add(normalizedDesc);
        // Update related alerts to include all event IDs
        merged.push({
          ...cause,
          relatedAlerts: [...new Set([...cause.relatedAlerts, ...eventIds])],
        });
      } else {
        // Merge with existing cause
        const existing = merged.find(
          (c) => c.description.toLowerCase().trim() === normalizedDesc
        );
        if (existing) {
          existing.confidence = Math.max(existing.confidence, cause.confidence);
          existing.evidence = [...new Set([...existing.evidence, ...cause.evidence])];
          existing.relatedAlerts = [...new Set([...existing.relatedAlerts, ...cause.relatedAlerts])];
        }
      }
    }

    // Add AI causes (usually higher quality)
    for (const cause of aiCauses) {
      const normalizedDesc = cause.description.toLowerCase().trim();
      if (!seenDescriptions.has(normalizedDesc)) {
        seenDescriptions.add(normalizedDesc);
        merged.push({
          ...cause,
          relatedAlerts: [...new Set([...cause.relatedAlerts, ...eventIds])],
        });
      }
    }

    // Sort by confidence (descending)
    return merged.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Filter events within correlation window
   */
  private filterEventsInWindow(events: UnifiedEvent[], windowMs: number): UnifiedEvent[] {
    if (events.length === 0) return [];

    // Sort by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const firstTimestamp = sorted[0].timestamp;

    // Filter events within window from first event
    return sorted.filter((e) => e.timestamp - firstTimestamp <= windowMs);
  }


  /**
   * Check if event is likely a cause
   */
  private isLikelyCause(event: UnifiedEvent): boolean {
    const causeIndicators = [
      /fail|error|down|disconnect|timeout|exhausted|full/i,
      /critical|emergency/i,
    ];
    return causeIndicators.some((pattern) => pattern.test(event.message));
  }

  /**
   * Check if event is likely an effect
   */
  private isLikelyEffect(event: UnifiedEvent): boolean {
    const effectIndicators = [
      /unable|cannot|blocked|denied|rejected/i,
      /secondary|cascade|result/i,
    ];
    return effectIndicators.some((pattern) => pattern.test(event.message));
  }

  /**
   * Build timeline description for an event
   */
  private buildTimelineDescription(event: UnifiedEvent): string {
    const severityEmoji: Record<AlertSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🔴',
      emergency: '🚨',
    };

    const emoji = severityEmoji[event.severity] || '📌';
    return `${emoji} [${event.category}] ${event.message}`;
  }

  /**
   * Extract affected resources from event
   */
  private extractAffectedResources(event: UnifiedEvent): string[] {
    const resources: string[] = [];

    // Add category
    if (event.category) {
      resources.push(event.category);
    }

    // Extract from metadata
    if (event.metadata?.interfaceName) {
      resources.push(event.metadata.interfaceName as string);
    }

    // Extract from alertRuleInfo
    if (event.alertRuleInfo?.metric) {
      resources.push(event.alertRuleInfo.metric);
    }

    // Extract from device info
    if (event.deviceInfo?.hostname) {
      resources.push(event.deviceInfo.hostname);
    }

    // Try to extract interface names from message
    const interfaceMatch = event.message.match(/interface[:\s]+(\S+)/i);
    if (interfaceMatch) {
      resources.push(interfaceMatch[1]);
    }

    // Try to extract IP addresses from message
    const ipMatch = event.message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    if (ipMatch) {
      resources.push(ipMatch[0]);
    }

    return [...new Set(resources)];
  }

  /**
   * Determine impact scope
   */
  private determineImpactScope(event: UnifiedEvent, rootCauses: RootCause[]): ImpactScope {
    // Check severity
    if (event.severity === 'emergency') {
      return 'widespread';
    }
    if (event.severity === 'critical') {
      return 'partial';
    }

    // Check root cause categories
    const hasSystemCause = rootCauses.some((c) => 
      c.description.toLowerCase().includes('cpu') ||
      c.description.toLowerCase().includes('memory') ||
      c.description.toLowerCase().includes('disk')
    );
    if (hasSystemCause) {
      return 'partial';
    }

    // Check number of related alerts
    const totalRelated = rootCauses.reduce((sum, c) => sum + c.relatedAlerts.length, 0);
    if (totalRelated > 5) {
      return 'widespread';
    }
    if (totalRelated > 2) {
      return 'partial';
    }

    return 'local';
  }

  /**
   * Identify affected services
   */
  private identifyAffectedServices(event: UnifiedEvent): string[] {
    const services: string[] = [];

    // Map categories to services
    const categoryServiceMap: Record<string, string[]> = {
      system: ['System Management', 'Monitoring'],
      interface: ['Network Connectivity', 'Routing'],
      security: ['Authentication', 'Firewall'],
      network: ['Routing', 'DNS', 'DHCP'],
    };

    const mappedServices = categoryServiceMap[event.category];
    if (mappedServices) {
      services.push(...mappedServices);
    }

    // Check message for service indicators
    if (event.message.toLowerCase().includes('dhcp')) {
      services.push('DHCP');
    }
    if (event.message.toLowerCase().includes('dns')) {
      services.push('DNS');
    }
    if (event.message.toLowerCase().includes('vpn')) {
      services.push('VPN');
    }
    if (event.message.toLowerCase().includes('firewall')) {
      services.push('Firewall');
    }

    return [...new Set(services)];
  }


  /**
   * Identify network segments
   */
  private identifyNetworkSegments(event: UnifiedEvent): string[] {
    const segments: string[] = [];

    // Extract from device info
    if (event.deviceInfo?.ip) {
      const ip = event.deviceInfo.ip;
      // Extract network segment (first 3 octets)
      const match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\./);
      if (match) {
        segments.push(`${match[1]}.0/24`);
      }
    }

    // Extract from message
    const subnetMatch = event.message.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\/\d{1,2}\b/);
    if (subnetMatch) {
      segments.push(subnetMatch[0]);
    }

    // Check for VLAN references
    const vlanMatch = event.message.match(/vlan[:\s]*(\d+)/i);
    if (vlanMatch) {
      segments.push(`VLAN ${vlanMatch[1]}`);
    }

    return [...new Set(segments)];
  }

  /**
   * Estimate affected users based on scope
   */
  private estimateAffectedUsers(scope: ImpactScope, resources: string[]): number {
    // Base estimates by scope
    const baseEstimates: Record<ImpactScope, number> = {
      local: 5,
      partial: 25,
      widespread: 100,
    };

    let estimate = baseEstimates[scope];

    // Adjust based on resource types
    const hasWanInterface = resources.some((r) => 
      r.toLowerCase().includes('wan') || 
      r.toLowerCase().includes('pppoe') ||
      r.toLowerCase().includes('lte')
    );
    if (hasWanInterface) {
      estimate *= 2;
    }

    const hasSystemResource = resources.some((r) =>
      r.toLowerCase().includes('cpu') ||
      r.toLowerCase().includes('memory') ||
      r.toLowerCase().includes('system')
    );
    if (hasSystemResource) {
      estimate *= 1.5;
    }

    return Math.round(estimate);
  }

  /**
   * Calculate similarity between event and historical analysis
   */
  private calculateSimilarity(event: UnifiedEvent, analysis: RootCauseAnalysis): number {
    let score = 0;
    let factors = 0;

    // Category match
    for (const rootCause of analysis.rootCauses) {
      const categoryMatch = ROOT_CAUSE_PATTERNS.find((p) => 
        rootCause.id.startsWith(p.id) && p.category === event.category
      );
      if (categoryMatch) {
        score += 0.3;
        factors++;
        break;
      }
    }

    // Message similarity (simple word overlap)
    const eventWords = new Set(event.message.toLowerCase().split(/\s+/));
    for (const rootCause of analysis.rootCauses) {
      const causeWords = new Set(rootCause.description.toLowerCase().split(/\s+/));
      const intersection = [...eventWords].filter((w) => causeWords.has(w));
      const union = new Set([...eventWords, ...causeWords]);
      const jaccard = intersection.length / union.size;
      if (jaccard > 0.1) {
        score += jaccard * 0.4;
        factors++;
        break;
      }
    }

    // Severity match
    const severityOrder: AlertSeverity[] = ['info', 'warning', 'critical', 'emergency'];
    const eventSeverityIndex = severityOrder.indexOf(event.severity);
    // Check if any root cause has similar severity based on confidence
    for (const rootCause of analysis.rootCauses) {
      if (rootCause.confidence > 70 && eventSeverityIndex >= 2) {
        score += 0.2;
        factors++;
        break;
      } else if (rootCause.confidence > 50 && eventSeverityIndex >= 1) {
        score += 0.1;
        factors++;
        break;
      }
    }

    // Impact scope match
    const scopeOrder: ImpactScope[] = ['local', 'partial', 'widespread'];
    const eventScope = this.determineImpactScope(event, []);
    if (analysis.impact.scope === eventScope) {
      score += 0.1;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Extract resolution from analysis
   */
  private extractResolution(analysis: RootCauseAnalysis): string | undefined {
    // Look for resolution hints in root causes
    for (const rootCause of analysis.rootCauses) {
      if (rootCause.evidence.length > 0) {
        const resolutionHint = rootCause.evidence.find((e) =>
          e.toLowerCase().includes('解决') ||
          e.toLowerCase().includes('修复') ||
          e.toLowerCase().includes('fix') ||
          e.toLowerCase().includes('resolve')
        );
        if (resolutionHint) {
          return resolutionHint;
        }
      }
    }
    return undefined;
  }


  /**
   * Get highest severity from events
   */
  private getHighestSeverity(events: UnifiedEvent[]): AlertSeverity {
    const severityOrder: AlertSeverity[] = ['info', 'warning', 'critical', 'emergency'];
    let highest: AlertSeverity = 'info';
    let highestIndex = 0;

    for (const event of events) {
      const index = severityOrder.indexOf(event.severity);
      if (index > highestIndex) {
        highestIndex = index;
        highest = event.severity;
      }
    }

    return highest;
  }

  /**
   * Get date range for searching
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentDate = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));

    const endDate = new Date(Date.UTC(
      toDate.getUTCFullYear(),
      toDate.getUTCMonth(),
      toDate.getUTCDate(),
      23, 59, 59, 999
    ));

    while (currentDate <= endDate) {
      dates.push(getDateString(currentDate.getTime()));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
  }

  // ==================== Public Utility Methods ====================

  /**
   * Get analysis by ID
   */
  async getAnalysis(analysisId: string): Promise<RootCauseAnalysis | null> {
    // Check cache first
    if (this.analysisCache.has(analysisId)) {
      return this.analysisCache.get(analysisId)!;
    }

    // Search in files (last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(thirtyDaysAgo, now);

    for (const dateStr of dates) {
      const analyses = await this.readAnalysisFile(dateStr);
      const found = analyses.find((a) => a.id === analysisId);
      if (found) {
        this.analysisCache.set(analysisId, found);
        return found;
      }
    }

    return null;
  }

  /**
   * Get analysis by alert ID
   */
  async getAnalysisByAlertId(alertId: string): Promise<RootCauseAnalysis | null> {
    // Check cache first
    for (const analysis of this.analysisCache.values()) {
      if (analysis.alertId === alertId) {
        return analysis;
      }
    }

    // Search in files (last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(thirtyDaysAgo, now);

    for (const dateStr of dates) {
      const analyses = await this.readAnalysisFile(dateStr);
      const found = analyses.find((a) => a.alertId === alertId);
      if (found) {
        this.analysisCache.set(found.id, found);
        return found;
      }
    }

    return null;
  }

  /**
   * Get recent analyses
   */
  async getRecentAnalyses(limit: number = 20): Promise<RootCauseAnalysis[]> {
    await this.initialize();

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(sevenDaysAgo, now).reverse(); // Most recent first

    const allAnalyses: RootCauseAnalysis[] = [];

    for (const dateStr of dates) {
      if (allAnalyses.length >= limit) break;

      const analyses = await this.readAnalysisFile(dateStr);
      allAnalyses.push(...analyses);
    }

    // Sort by timestamp descending and limit
    return allAnalyses
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    logger.info('RootCauseAnalyzer cache cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    cacheSize: number;
    initialized: boolean;
  } {
    return {
      cacheSize: this.analysisCache.size,
      initialized: this.initialized,
    };
  }
}

// Export singleton instance
export const rootCauseAnalyzer = new RootCauseAnalyzer();
