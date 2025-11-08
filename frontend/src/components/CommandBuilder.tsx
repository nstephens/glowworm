import React, { useState, useCallback } from 'react';
import { 
  Code, 
  Play, 
  Save, 
  Trash2, 
  Plus, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  Copy,
  Edit,
  Check
} from 'lucide-react';

interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: CommandParameter[];
  category: string;
}

interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: string[];
  description?: string;
}

interface CommandBuilderProps {
  onCommandGenerated: (command: string, data: any) => void;
  onSaveTemplate?: (template: CommandTemplate) => void;
  className?: string;
}

const DEFAULT_TEMPLATES: CommandTemplate[] = [
  {
    id: 'start_slideshow',
    name: 'Start Slideshow',
    description: 'Start playing the current slideshow',
    command: 'start_slideshow',
    parameters: [],
    category: 'Playback'
  },
  {
    id: 'pause_slideshow',
    name: 'Pause Slideshow',
    description: 'Pause the current slideshow',
    command: 'pause_slideshow',
    parameters: [],
    category: 'Playback'
  },
  {
    id: 'stop_slideshow',
    name: 'Stop Slideshow',
    description: 'Stop the current slideshow',
    command: 'stop_slideshow',
    parameters: [],
    category: 'Playback'
  },
  {
    id: 'next_image',
    name: 'Next Image',
    description: 'Go to the next image in the slideshow',
    command: 'next_image',
    parameters: [],
    category: 'Navigation'
  },
  {
    id: 'previous_image',
    name: 'Previous Image',
    description: 'Go to the previous image in the slideshow',
    command: 'previous_image',
    parameters: [],
    category: 'Navigation'
  },
  {
    id: 'goto_image',
    name: 'Go to Image',
    description: 'Jump to a specific image by index',
    command: 'goto_image',
    parameters: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Image index (0-based)'
      }
    ],
    category: 'Navigation'
  },
  {
    id: 'load_playlist',
    name: 'Load Playlist',
    description: 'Load a specific playlist',
    command: 'load_playlist',
    parameters: [
      {
        name: 'playlist_id',
        type: 'number',
        required: true,
        description: 'ID of the playlist to load'
      }
    ],
    category: 'Playlist'
  },
  {
    id: 'set_volume',
    name: 'Set Volume',
    description: 'Set the volume level',
    command: 'set_volume',
    parameters: [
      {
        name: 'volume',
        type: 'number',
        required: true,
        defaultValue: 50,
        description: 'Volume level (0-100)'
      }
    ],
    category: 'Audio'
  },
  {
    id: 'set_transition',
    name: 'Set Transition',
    description: 'Set the transition effect between images',
    command: 'set_transition',
    parameters: [
      {
        name: 'transition',
        type: 'select',
        required: true,
        defaultValue: 'fade',
        options: ['fade', 'slide', 'zoom', 'none'],
        description: 'Transition effect type'
      }
    ],
    category: 'Display'
  },
  {
    id: 'set_interval',
    name: 'Set Interval',
    description: 'Set the time interval between images',
    command: 'set_interval',
    parameters: [
      {
        name: 'interval',
        type: 'number',
        required: true,
        defaultValue: 5,
        description: 'Interval in seconds'
      }
    ],
    category: 'Display'
  },
  {
    id: 'restart_display',
    name: 'Restart Display',
    description: 'Restart the display device',
    command: 'restart_display',
    parameters: [],
    category: 'System'
  },
  {
    id: 'refresh_status',
    name: 'Refresh Status',
    description: 'Refresh the device status',
    command: 'refresh_status',
    parameters: [],
    category: 'System'
  }
];

export const CommandBuilder: React.FC<CommandBuilderProps> = ({
  onCommandGenerated,
  onSaveTemplate,
  className = ''
}) => {
  const [templates, setTemplates] = useState<CommandTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [customCommand, setCustomCommand] = useState('');
  const [customData, setCustomData] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Playback', 'Navigation']));
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommandTemplate | null>(null);

  const categories = Array.from(new Set(templates.map(t => t.category)));

  const handleTemplateSelect = useCallback((template: CommandTemplate) => {
    setSelectedTemplate(template);
    setShowCustom(false);
    
    // Initialize parameter values with defaults
    const values: Record<string, any> = {};
    template.parameters.forEach(param => {
      values[param.name] = param.defaultValue || '';
    });
    setParameterValues(values);
  }, []);

  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  }, []);

  const handleGenerateCommand = useCallback(() => {
    if (selectedTemplate) {
      const data: Record<string, any> = {};
      
      selectedTemplate.parameters.forEach(param => {
        if (param.required && !parameterValues[param.name]) {
          alert(`Parameter "${param.name}" is required`);
          return;
        }
        
        if (parameterValues[param.name] !== undefined && parameterValues[param.name] !== '') {
          data[param.name] = parameterValues[param.name];
        }
      });
      
      onCommandGenerated(selectedTemplate.command, data);
    } else if (showCustom && customCommand.trim()) {
      try {
        const data = customData.trim() ? JSON.parse(customData) : {};
        onCommandGenerated(customCommand, data);
      } catch (err) {
        alert('Invalid JSON in custom data');
      }
    }
  }, [selectedTemplate, parameterValues, showCustom, customCommand, customData, onCommandGenerated]);

  const handleSaveTemplate = useCallback(() => {
    if (editingTemplate && onSaveTemplate) {
      onSaveTemplate(editingTemplate);
      setTemplates(prev => {
        const existing = prev.find(t => t.id === editingTemplate.id);
        if (existing) {
          return prev.map(t => t.id === editingTemplate.id ? editingTemplate : t);
        } else {
          return [...prev, editingTemplate];
        }
      });
      setIsEditing(false);
      setEditingTemplate(null);
    }
  }, [editingTemplate, onSaveTemplate]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    }
  }, [selectedTemplate]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const renderParameterInput = (param: CommandParameter) => {
    const value = parameterValues[param.name] || param.defaultValue || '';

    switch (param.type) {
      case 'string':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.description}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
            placeholder={param.description}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleParameterChange(param.name, e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {param.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Code className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Command Builder</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`px-3 py-1 rounded text-sm ${
              showCustom 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Selection */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Command Templates</h4>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {categories.map(category => (
              <div key={category} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{category}</span>
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                {expandedCategories.has(category) && (
                  <div className="border-t border-gray-200">
                    {templates
                      .filter(t => t.category === category)
                      .map(template => (
                        <div
                          key={template.id}
                          className={`p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                            selectedTemplate?.id === template.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{template.name}</p>
                              <p className="text-sm text-gray-500">{template.description}</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTemplate(template);
                                  setIsEditing(true);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(template.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Command Configuration */}
        <div>
          {selectedTemplate && !showCustom ? (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Configure: {selectedTemplate.name}
              </h4>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    {selectedTemplate.description}
                  </p>
                  <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                    {selectedTemplate.command}
                  </div>
                </div>

                {selectedTemplate.parameters.map(param => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {param.description && (
                      <p className="text-xs text-gray-500 mb-2">{param.description}</p>
                    )}
                    {renderParameterInput(param)}
                  </div>
                ))}

                <button
                  onClick={handleGenerateCommand}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Generate Command</span>
                </button>
              </div>
            </div>
          ) : showCustom ? (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Command</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Command
                  </label>
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="e.g., custom_action"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data (JSON)
                  </label>
                  <textarea
                    value={customData}
                    onChange={(e) => setCustomData(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <button
                  onClick={handleGenerateCommand}
                  disabled={!customCommand.trim()}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Generate Command</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a command template to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Template Editor Modal */}
      {isEditing && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Template: {editingTemplate.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    description: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Command
                </label>
                <input
                  type="text"
                  value={editingTemplate.command}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    command: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editingTemplate.category}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    category: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandBuilder;

















