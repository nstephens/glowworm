// Bundle Analysis Utilities
// Provides utilities for analyzing bundle size, identifying large dependencies, and optimizing imports

interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkAnalysis[];
  dependencies: DependencyAnalysis[];
  recommendations: string[];
}

interface ChunkAnalysis {
  name: string;
  size: number;
  gzippedSize: number;
  modules: ModuleAnalysis[];
}

interface ModuleAnalysis {
  name: string;
  size: number;
  gzippedSize: number;
  dependencies: string[];
}

interface DependencyAnalysis {
  name: string;
  version: string;
  size: number;
  gzippedSize: number;
  type: 'production' | 'development' | 'peer';
  usage: string[];
}

class BundleAnalyzer {
  private static instance: BundleAnalyzer;
  private analysis: BundleAnalysis | null = null;

  static getInstance(): BundleAnalyzer {
    if (!BundleAnalyzer.instance) {
      BundleAnalyzer.instance = new BundleAnalyzer();
    }
    return BundleAnalyzer.instance;
  }

  // Analyze current bundle
  async analyzeBundle(): Promise<BundleAnalysis> {
    if (this.analysis) {
      return this.analysis;
    }

    try {
      // This would typically be done at build time
      // For now, we'll provide a mock analysis
      this.analysis = await this.generateMockAnalysis();
      return this.analysis;
    } catch (error) {
      console.error('Bundle analysis failed:', error);
      throw error;
    }
  }

  private async generateMockAnalysis(): Promise<BundleAnalysis> {
    // Mock analysis - in a real implementation, this would analyze the actual bundle
    return {
      totalSize: 1024 * 1024, // 1MB
      gzippedSize: 256 * 1024, // 256KB
      chunks: [
        {
          name: 'main',
          size: 512 * 1024,
          gzippedSize: 128 * 1024,
          modules: [
            {
              name: 'react',
              size: 64 * 1024,
              gzippedSize: 16 * 1024,
              dependencies: [],
            },
            {
              name: 'react-dom',
              size: 128 * 1024,
              gzippedSize: 32 * 1024,
              dependencies: ['react'],
            },
          ],
        },
        {
          name: 'vendor',
          size: 512 * 1024,
          gzippedSize: 128 * 1024,
          modules: [
            {
              name: 'lodash',
              size: 256 * 1024,
              gzippedSize: 64 * 1024,
              dependencies: [],
            },
          ],
        },
      ],
      dependencies: [
        {
          name: 'react',
          version: '18.2.0',
          size: 64 * 1024,
          gzippedSize: 16 * 1024,
          type: 'production',
          usage: ['components', 'hooks'],
        },
        {
          name: 'lodash',
          version: '4.17.21',
          size: 256 * 1024,
          gzippedSize: 64 * 1024,
          type: 'production',
          usage: ['utilities'],
        },
      ],
      recommendations: [
        'Consider using lodash-es for tree shaking',
        'Implement code splitting for large components',
        'Use dynamic imports for non-critical features',
      ],
    };
  }

  // Get bundle size recommendations
  getRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = [];

    // Check for large dependencies
    const largeDeps = analysis.dependencies.filter(dep => dep.size > 100 * 1024);
    if (largeDeps.length > 0) {
      recommendations.push(`Consider replacing large dependencies: ${largeDeps.map(dep => dep.name).join(', ')}`);
    }

    // Check for unused dependencies
    const unusedDeps = analysis.dependencies.filter(dep => dep.usage.length === 0);
    if (unusedDeps.length > 0) {
      recommendations.push(`Remove unused dependencies: ${unusedDeps.map(dep => dep.name).join(', ')}`);
    }

    // Check for duplicate dependencies
    const duplicateDeps = this.findDuplicateDependencies(analysis);
    if (duplicateDeps.length > 0) {
      recommendations.push(`Resolve duplicate dependencies: ${duplicateDeps.join(', ')}`);
    }

    // Check for large chunks
    const largeChunks = analysis.chunks.filter(chunk => chunk.size > 500 * 1024);
    if (largeChunks.length > 0) {
      recommendations.push(`Split large chunks: ${largeChunks.map(chunk => chunk.name).join(', ')}`);
    }

    return recommendations;
  }

  private findDuplicateDependencies(analysis: BundleAnalysis): string[] {
    const depCounts = new Map<string, number>();
    
    analysis.dependencies.forEach(dep => {
      const count = depCounts.get(dep.name) || 0;
      depCounts.set(dep.name, count + 1);
    });

    return Array.from(depCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, _]) => name);
  }

  // Calculate bundle size metrics
  calculateMetrics(analysis: BundleAnalysis): {
    compressionRatio: number;
    averageChunkSize: number;
    largestChunk: string;
    smallestChunk: string;
  } {
    const compressionRatio = analysis.gzippedSize / analysis.totalSize;
    const averageChunkSize = analysis.totalSize / analysis.chunks.length;
    
    const largestChunk = analysis.chunks.reduce((prev, current) => 
      prev.size > current.size ? prev : current
    );
    
    const smallestChunk = analysis.chunks.reduce((prev, current) => 
      prev.size < current.size ? prev : current
    );

    return {
      compressionRatio,
      averageChunkSize,
      largestChunk: largestChunk.name,
      smallestChunk: smallestChunk.name,
    };
  }

  // Generate bundle report
  generateReport(analysis: BundleAnalysis): string {
    const metrics = this.calculateMetrics(analysis);
    const recommendations = this.getRecommendations(analysis);

    return `
# Bundle Analysis Report

## Overview
- **Total Size**: ${(analysis.totalSize / 1024).toFixed(2)} KB
- **Gzipped Size**: ${(analysis.gzippedSize / 1024).toFixed(2)} KB
- **Compression Ratio**: ${(metrics.compressionRatio * 100).toFixed(1)}%
- **Average Chunk Size**: ${(metrics.averageChunkSize / 1024).toFixed(2)} KB

## Chunks
${analysis.chunks.map(chunk => `
### ${chunk.name}
- Size: ${(chunk.size / 1024).toFixed(2)} KB
- Gzipped: ${(chunk.gzippedSize / 1024).toFixed(2)} KB
- Modules: ${chunk.modules.length}
`).join('')}

## Dependencies
${analysis.dependencies.map(dep => `
### ${dep.name} (${dep.version})
- Size: ${(dep.size / 1024).toFixed(2)} KB
- Gzipped: ${(dep.gzippedSize / 1024).toFixed(2)} KB
- Type: ${dep.type}
- Usage: ${dep.usage.join(', ')}
`).join('')}

## Recommendations
${recommendations.map(rec => `- ${rec}`).join('\n')}
    `.trim();
  }
}

// Export utilities
export { BundleAnalyzer };
export type { BundleAnalysis, ChunkAnalysis, ModuleAnalysis, DependencyAnalysis };

// Hook for bundle analysis
export function useBundleAnalysis() {
  const [analysis, setAnalysis] = useState<BundleAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const analyzer = BundleAnalyzer.getInstance();
      const result = await analyzer.analyzeBundle();
      setAnalysis(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    analyze();
  }, [analyze]);

  return { analysis, isLoading, error, analyze };
}

// Utility for checking bundle size budget
export function checkBundleSizeBudget(
  analysis: BundleAnalysis,
  budget: {
    maxTotalSize: number;
    maxChunkSize: number;
    maxDependencySize: number;
  }
): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (analysis.totalSize > budget.maxTotalSize) {
    violations.push(`Total bundle size (${analysis.totalSize} bytes) exceeds budget (${budget.maxTotalSize} bytes)`);
  }

  analysis.chunks.forEach(chunk => {
    if (chunk.size > budget.maxChunkSize) {
      violations.push(`Chunk ${chunk.name} (${chunk.size} bytes) exceeds budget (${budget.maxChunkSize} bytes)`);
    }
  });

  analysis.dependencies.forEach(dep => {
    if (dep.size > budget.maxDependencySize) {
      violations.push(`Dependency ${dep.name} (${dep.size} bytes) exceeds budget (${budget.maxDependencySize} bytes)`);
    }
  });

  return {
    passed: violations.length === 0,
    violations,
  };
}
