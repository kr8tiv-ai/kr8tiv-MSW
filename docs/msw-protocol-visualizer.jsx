import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Database, MessageSquare, Search, FileText, CheckCircle, Play, RefreshCw, GitBranch, Zap } from 'lucide-react';

export default function MSWProtocolVisualizer() {
  const [activeLayer, setActiveLayer] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  const layers = [
    {
      id: 'ingest',
      name: '1. Ingest Layer',
      icon: Database,
      color: 'bg-blue-500',
      description: 'Analyze codebase structure, dependencies, and patterns',
      inputs: ['Local directories', 'GitHub repos', 'Existing docs'],
      outputs: ['STRUCTURE.md', 'DEPENDENCIES.md', 'CONVENTIONS.md', 'ARCHITECTURE.md'],
      tools: ['Parallel agent orchestration', 'AST parsing', 'Dependency analysis']
    },
    {
      id: 'interview',
      name: '2. Interview Layer',
      icon: MessageSquare,
      color: 'bg-green-500',
      description: 'Understand goals, difficulties, and requirements',
      inputs: ['User responses', 'Agent error logs', 'Constraints'],
      outputs: ['GOALS.md', 'DIFFICULTIES.md', 'AGENT_ISSUES.md', 'CONSTRAINTS.md'],
      tools: ['Structured interview flow', 'Context extraction']
    },
    {
      id: 'research',
      name: '3. Research Layer',
      icon: Search,
      color: 'bg-purple-500',
      description: 'Query NotebookLM for grounded best practices',
      inputs: ['Generated questions', 'Notebook library', 'Context'],
      outputs: ['FINDINGS.md', 'BEST_PRACTICES.md', 'EDGE_CASES.md'],
      tools: ['NotebookLM MCP', 'Auto question generation', 'Follow-up chains']
    },
    {
      id: 'planning',
      name: '4. Planning Layer',
      icon: FileText,
      color: 'bg-yellow-500',
      description: 'Generate PRD and phase plans (GSD format)',
      inputs: ['Research findings', 'Interview data', 'Codebase map'],
      outputs: ['PRD.md', 'ROADMAP.md', 'Phase PLAN.md files'],
      tools: ['GSD protocol', 'XML task formatting', 'Phase generation']
    },
    {
      id: 'approval',
      name: '5. Approval Gate',
      icon: CheckCircle,
      color: 'bg-orange-500',
      description: 'Human review before autonomous execution',
      inputs: ['PRD summary', 'Key decisions', 'Scope overview'],
      outputs: ['Approved/Edit/Reject decision'],
      tools: ['CLI interface', 'Telegram integration', 'Review dashboard']
    },
    {
      id: 'execution',
      name: '6. Execution Layer',
      icon: Play,
      color: 'bg-red-500',
      description: 'Ralph Wiggum loop with NotebookLM feedback',
      inputs: ['Phase plans', 'Research context', 'Completion criteria'],
      outputs: ['Implemented code', 'Git commits', 'Iteration logs'],
      tools: ['Ralph loop', 'Fresh context per iteration', 'NotebookLM on-stuck']
    },
    {
      id: 'verification',
      name: '7. Verification Layer',
      icon: CheckCircle,
      color: 'bg-teal-500',
      description: 'Confirm implementation actually works',
      inputs: ['Test commands', 'Coverage thresholds', 'Custom checks'],
      outputs: ['Verification report', 'Fix plans if failed'],
      tools: ['Automated testing', 'Coverage analysis', 'API checks']
    }
  ];

  const components = [
    {
      name: 'GSD Protocol',
      description: 'Spec-driven development with context engineering',
      features: ['Context files (PROJECT.md, ROADMAP.md)', 'Multi-agent orchestration', 'Phase-based planning', 'Atomic git commits'],
      color: 'border-blue-400'
    },
    {
      name: 'NotebookLM MCP',
      description: 'Research grounding with zero-hallucination answers',
      features: ['Direct agent queries', 'Citation-backed responses', 'Auto follow-ups', 'Notebook library management'],
      color: 'border-purple-400'
    },
    {
      name: 'Ralph Wiggum Loop',
      description: 'Continuous iteration until verifiable success',
      features: ['Stop hook mechanism', 'Fresh context rotation', 'Completion promises', 'Max iteration safety'],
      color: 'border-red-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">MSW Protocol</h1>
          <p className="text-xl text-gray-400">"Make Shit Work" - Research-Grounded Autonomous Coding</p>
        </div>

        <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={() => setShowComparison(false)}
            className={`px-4 py-2 rounded-lg ${!showComparison ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Architecture Flow
          </button>
          <button
            onClick={() => setShowComparison(true)}
            className={`px-4 py-2 rounded-lg ${showComparison ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Component Breakdown
          </button>
        </div>

        {!showComparison ? (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="text-yellow-400" />
                The Problem MSW Solves
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { problem: 'Context rot', solution: 'Fresh context per iteration' },
                  { problem: 'Hallucinated APIs', solution: 'NotebookLM grounding' },
                  { problem: 'Premature exit', solution: 'Ralph completion criteria' },
                  { problem: 'Knowledge gaps', solution: 'Auto research questions' },
                  { problem: 'Manual research', solution: 'MCP integration' },
                  { problem: 'Endless loops', solution: 'Max iterations + verification' }
                ].map((item, i) => (
                  <div key={i} className="bg-gray-700 rounded-lg p-3">
                    <div className="text-red-400 text-sm line-through">{item.problem}</div>
                    <div className="text-green-400 text-sm">→ {item.solution}</div>
                  </div>
                ))}
              </div>
            </div>

            {layers.map((layer, index) => (
              <div key={layer.id} className="relative">
                {index > 0 && (
                  <div className="absolute left-8 -top-4 h-4 w-0.5 bg-gray-600" />
                )}
                <div
                  className={`bg-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all ${
                    activeLayer === layer.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setActiveLayer(activeLayer === layer.id ? null : layer.id)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className={`${layer.color} p-3 rounded-lg`}>
                      <layer.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{layer.name}</h3>
                      <p className="text-gray-400 text-sm">{layer.description}</p>
                    </div>
                    {activeLayer === layer.id ? <ChevronDown /> : <ChevronRight />}
                  </div>
                  
                  {activeLayer === layer.id && (
                    <div className="px-4 pb-4 grid md:grid-cols-3 gap-4">
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Inputs</h4>
                        <ul className="text-sm space-y-1">
                          {layer.inputs.map((input, i) => (
                            <li key={i} className="text-gray-300">• {input}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">Outputs</h4>
                        <ul className="text-sm space-y-1">
                          {layer.outputs.map((output, i) => (
                            <li key={i} className="text-gray-300">• {output}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-purple-400 mb-2">Tools</h4>
                        <ul className="text-sm space-y-1">
                          {layer.tools.map((tool, i) => (
                            <li key={i} className="text-gray-300">• {tool}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
                
                {index === 5 && (
                  <div className="ml-16 mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw size={14} />
                    <span>Ralph loop iterates until completion criteria met</span>
                  </div>
                )}
              </div>
            ))}

            <div className="bg-gray-800 rounded-xl p-4 mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitBranch className="text-green-400" />
                <span>Complete: Tag release, archive milestone</span>
              </div>
              <div className="text-gray-500 text-sm">
                Then: /msw:init for next milestone
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {components.map((comp) => (
              <div key={comp.name} className={`bg-gray-800 rounded-xl p-6 border-l-4 ${comp.color}`}>
                <h3 className="text-xl font-semibold mb-2">{comp.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{comp.description}</p>
                <ul className="space-y-2">
                  {comp.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            
            <div className="md:col-span-3 bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-center">How They Combine in MSW</h3>
              <div className="flex flex-wrap justify-center gap-4 items-center">
                <div className="bg-blue-800 px-4 py-2 rounded-lg">GSD Planning</div>
                <span className="text-2xl">+</span>
                <div className="bg-purple-800 px-4 py-2 rounded-lg">NotebookLM Research</div>
                <span className="text-2xl">+</span>
                <div className="bg-red-800 px-4 py-2 rounded-lg">Ralph Execution</div>
                <span className="text-2xl">=</span>
                <div className="bg-green-700 px-4 py-2 rounded-lg font-bold">MSW Protocol</div>
              </div>
              <p className="text-center mt-4 text-gray-300">
                Research-grounded specs → Autonomous iteration → Verified completion
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-gray-500"># Initialize MSW on your project</div>
            <div className="text-green-400">/msw:init --local ./src --github user/repo</div>
            <div className="text-gray-500 mt-2"># System runs: ingest → interview → research → plan</div>
            <div className="text-gray-500"># Then awaits approval...</div>
            <div className="text-gray-500 mt-2"># After approval:</div>
            <div className="text-green-400">/msw:execute --phase 1 --max-iterations 30</div>
            <div className="text-gray-500"># Ralph loops until tests pass</div>
          </div>
        </div>
      </div>
    </div>
  );
}
