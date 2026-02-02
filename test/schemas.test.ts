import { describe, it, expect } from 'vitest';
import {
  ComponentTargetSchema,
  type ComponentTarget,
  FingerprintSchema,
  type Fingerprint,
  CandidateRepoTier1Schema,
  type CandidateRepoTier1,
  ValidationResultSchema,
  type ValidationResult,
  FocusBundleSchema,
  type FocusBundle,
  RunHintsSchema,
  type RunHints,
  ProvenanceSchema,
  type Provenance,
  CompareReportSchema,
  type CompareReport,
} from '../src/schemas/index.js';

describe('ComponentTargetSchema', () => {
  it('should parse valid ComponentTarget', () => {
    const valid: ComponentTarget = {
      kind: 'mcp-server',
      confidence: 0.85,
      signals: ['SKILL.md found', 'exports MCP handler'],
      searchHints: {
        keywords: ['mcp', 'server', 'model-context-protocol'],
        topics: ['mcp', 'ai-tools'],
        languageBias: 'typescript',
      },
    };
    expect(ComponentTargetSchema.parse(valid)).toEqual(valid);
  });

  it('should accept all valid kinds', () => {
    const kinds = ['mcp-server', 'cli', 'skill', 'hook', 'plugin', 'library'] as const;
    for (const kind of kinds) {
      const target = {
        kind,
        confidence: 0.5,
        signals: [],
        searchHints: { keywords: [], topics: [] },
      };
      expect(ComponentTargetSchema.parse(target).kind).toBe(kind);
    }
  });

  it('should reject invalid kind', () => {
    const invalid = {
      kind: 'invalid-kind',
      confidence: 0.5,
      signals: [],
      searchHints: { keywords: [], topics: [] },
    };
    expect(() => ComponentTargetSchema.parse(invalid)).toThrow();
  });

  it('should reject confidence out of range', () => {
    const tooLow = {
      kind: 'cli',
      confidence: -0.1,
      signals: [],
      searchHints: { keywords: [], topics: [] },
    };
    const tooHigh = {
      kind: 'cli',
      confidence: 1.1,
      signals: [],
      searchHints: { keywords: [], topics: [] },
    };
    expect(() => ComponentTargetSchema.parse(tooLow)).toThrow();
    expect(() => ComponentTargetSchema.parse(tooHigh)).toThrow();
  });

  it('should allow optional languageBias', () => {
    const withoutBias = {
      kind: 'skill' as const,
      confidence: 0.7,
      signals: ['test'],
      searchHints: { keywords: ['test'], topics: ['test'] },
    };
    const result = ComponentTargetSchema.parse(withoutBias);
    expect(result.searchHints.languageBias).toBeUndefined();
  });
});

describe('FingerprintSchema', () => {
  it('should parse valid Fingerprint', () => {
    const valid: Fingerprint = {
      root: '/Users/test/project',
      commit: 'abc123def456',
      timestamp: '2025-01-15T10:30:00.000Z',
      languageCounts: { typescript: 50, javascript: 20 },
      keyMarkers: ['SKILL.md', 'hooks/', 'package.json'],
    };
    expect(FingerprintSchema.parse(valid)).toEqual(valid);
  });

  it('should allow optional commit', () => {
    const noCommit = {
      root: '/some/path',
      timestamp: '2025-01-15T10:30:00.000Z',
      languageCounts: {},
      keyMarkers: [],
    };
    const result = FingerprintSchema.parse(noCommit);
    expect(result.commit).toBeUndefined();
  });

  it('should accept any path string', () => {
    const relativePath = {
      root: 'relative/path',
      timestamp: '2025-01-15T10:30:00.000Z',
      languageCounts: {},
      keyMarkers: [],
    };
    // Schema accepts any string for root - path validation is done at runtime
    expect(FingerprintSchema.parse(relativePath).root).toBe('relative/path');
  });

  it('should reject invalid timestamp format', () => {
    const invalidTimestamp = {
      root: '/valid/path',
      timestamp: 'not-a-date',
      languageCounts: {},
      keyMarkers: [],
    };
    expect(() => FingerprintSchema.parse(invalidTimestamp)).toThrow();
  });
});

describe('CandidateRepoTier1Schema', () => {
  it('should parse valid CandidateRepoTier1', () => {
    const valid: CandidateRepoTier1 = {
      repo: 'owner/repo-name',
      url: 'https://github.com/owner/repo-name',
      stars: 1500,
      forks: 200,
      pushedAt: '2025-01-10T08:00:00.000Z',
      licenseSpdx: 'MIT',
      description: 'A great project',
      topics: ['typescript', 'cli', 'mcp'],
      laneHits: ['keyword-search', 'topic-match'],
      tier1Score: 0.82,
    };
    expect(CandidateRepoTier1Schema.parse(valid)).toEqual(valid);
  });

  it('should allow null licenseSpdx and description', () => {
    const nullFields = {
      repo: 'owner/repo',
      url: 'https://github.com/owner/repo',
      stars: 100,
      forks: 10,
      pushedAt: '2025-01-01T00:00:00.000Z',
      licenseSpdx: null,
      description: null,
      topics: [],
      laneHits: [],
      tier1Score: 0.5,
    };
    const result = CandidateRepoTier1Schema.parse(nullFields);
    expect(result.licenseSpdx).toBeNull();
    expect(result.description).toBeNull();
  });

  it('should reject invalid URL', () => {
    const invalidUrl = {
      repo: 'owner/repo',
      url: 'not-a-url',
      stars: 100,
      forks: 10,
      pushedAt: '2025-01-01T00:00:00.000Z',
      licenseSpdx: null,
      description: null,
      topics: [],
      laneHits: [],
      tier1Score: 0.5,
    };
    expect(() => CandidateRepoTier1Schema.parse(invalidUrl)).toThrow();
  });

  it('should reject negative stars or forks', () => {
    const negativeStars = {
      repo: 'owner/repo',
      url: 'https://github.com/owner/repo',
      stars: -1,
      forks: 10,
      pushedAt: '2025-01-01T00:00:00.000Z',
      licenseSpdx: null,
      description: null,
      topics: [],
      laneHits: [],
      tier1Score: 0.5,
    };
    expect(() => CandidateRepoTier1Schema.parse(negativeStars)).toThrow();
  });
});

describe('ValidationResultSchema', () => {
  it('should parse valid ValidationResult', () => {
    const valid: ValidationResult = {
      repo: 'owner/repo',
      localPath: '/tmp/scout/owner-repo',
      matchedTargets: [
        {
          kind: 'mcp-server',
          evidence: ['has SKILL.md', 'exports handler'],
          focusRoots: ['src/mcp/', 'lib/'],
        },
      ],
      modernitySignals: [
        { check: 'hasTypeScript', passed: true },
        { check: 'hasESM', passed: true, detail: 'type: module in package.json' },
        { check: 'hasCIConfig', passed: false },
      ],
      structuralMatchCount: 3,
      modernityScore: 0.75,
      tier1Score: 0.82,
      tier2Score: 0.78,
      entrypointCandidates: [
        { kind: 'mcp-server', paths: ['src/index.ts', 'src/server.ts'] },
      ],
    };
    expect(ValidationResultSchema.parse(valid)).toEqual(valid);
  });

  it('should reject missing required fields', () => {
    const missing = {
      repo: 'owner/repo',
      localPath: '/tmp/path',
    };
    expect(() => ValidationResultSchema.parse(missing)).toThrow();
  });
});

describe('FocusBundleSchema', () => {
  it('should parse valid FocusBundle', () => {
    const valid: FocusBundle = {
      repo: 'owner/repo',
      entrypoints: [
        { kind: 'mcp-server', path: 'src/index.ts', reason: 'main export' },
      ],
      scopeRoots: ['src/', 'lib/'],
      files: [
        { path: 'src/index.ts', sizeBytes: 1024 },
        { path: 'src/handler.ts', sizeBytes: 2048 },
      ],
    };
    expect(FocusBundleSchema.parse(valid)).toEqual(valid);
  });
});

describe('RunHintsSchema', () => {
  it('should parse valid RunHints', () => {
    const valid: RunHints = {
      scripts: [
        { name: 'build', command: 'tsc' },
        { name: 'test', command: 'vitest run' },
      ],
      buildTool: 'vite',
    };
    expect(RunHintsSchema.parse(valid)).toEqual(valid);
  });

  it('should allow optional buildTool', () => {
    const noBuildTool = {
      scripts: [{ name: 'start', command: 'node index.js' }],
    };
    const result = RunHintsSchema.parse(noBuildTool);
    expect(result.buildTool).toBeUndefined();
  });
});

describe('ProvenanceSchema', () => {
  it('should parse valid Provenance', () => {
    const valid: Provenance = {
      repo: 'owner/repo',
      url: 'https://github.com/owner/repo',
      sha: 'abc123def456789',
      license: 'MIT',
      tier1Score: 0.82,
      tier2Score: 0.78,
      toolVersion: '0.1.0',
      runId: 'run-123-456',
      timestamp: '2025-01-15T10:30:00.000Z',
    };
    expect(ProvenanceSchema.parse(valid)).toEqual(valid);
  });
});

describe('CompareReportSchema', () => {
  it('should parse valid CompareReport', () => {
    const valid: CompareReport = {
      runId: 'run-abc-123',
      timestamp: '2025-01-15T10:30:00.000Z',
      sourceProject: {
        root: '/Users/test/myproject',
        commit: 'def456',
        targetKinds: ['mcp-server', 'cli'],
      },
      candidates: [
        {
          repo: 'owner/best-repo',
          tier1Score: 0.9,
          tier2Score: 0.85,
          matchedKinds: ['mcp-server'],
          modernityScore: 0.92,
          license: 'MIT',
          topEntrypoints: ['src/index.ts'],
        },
      ],
      summary: {
        totalDiscovered: 50,
        cloned: 10,
        validated: 5,
        topRecommendation: 'owner/best-repo',
      },
    };
    expect(CompareReportSchema.parse(valid)).toEqual(valid);
  });

  it('should allow optional fields in sourceProject and summary', () => {
    const minimal = {
      runId: 'run-123',
      timestamp: '2025-01-15T10:30:00.000Z',
      sourceProject: {
        root: '/some/path',
        targetKinds: [],
      },
      candidates: [],
      summary: {
        totalDiscovered: 0,
        cloned: 0,
        validated: 0,
      },
    };
    const result = CompareReportSchema.parse(minimal);
    expect(result.sourceProject.commit).toBeUndefined();
    expect(result.summary.topRecommendation).toBeUndefined();
  });
});
