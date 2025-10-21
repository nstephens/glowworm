import React, { useState } from 'react';
import { 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  Shuffle, 
  Repeat, 
  Info, 
  Volume2, 
  VolumeX,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';

interface SlideshowSettingsProps {
  settings: {
    autoPlay: boolean;
    interval: number;
    transition: 'fade' | 'slide' | 'zoom' | 'none';
    showControls: boolean;
    showInfo: boolean;
    shuffle: boolean;
    loop: boolean;
    volume: number;
  };
  onSettingsChange: (settings: any) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SlideshowSettings: React.FC<SlideshowSettingsProps> = ({
  settings,
  onSettingsChange,
  onReset,
  isOpen,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleReset = () => {
    const defaultSettings = {
      autoPlay: true,
      interval: 5,
      transition: 'fade' as const,
      showControls: true,
      showInfo: true,
      shuffle: false,
      loop: true,
      volume: 0.5,
    };
    setLocalSettings(defaultSettings);
    onSettingsChange(defaultSettings);
    onReset();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Slideshow Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Playback Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Play className="w-4 h-4 mr-2" />
              Playback
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Auto Play</label>
                <input
                  type="checkbox"
                  checked={localSettings.autoPlay}
                  onChange={(e) => handleSettingChange('autoPlay', e.target.checked)}
                  className="rounded"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-2">
                  Interval: {localSettings.interval}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={localSettings.interval}
                  onChange={(e) => handleSettingChange('interval', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1s</span>
                  <span>30s</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Loop</label>
                <input
                  type="checkbox"
                  checked={localSettings.loop}
                  onChange={(e) => handleSettingChange('loop', e.target.checked)}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Shuffle</label>
                <input
                  type="checkbox"
                  checked={localSettings.shuffle}
                  onChange={(e) => handleSettingChange('shuffle', e.target.checked)}
                  className="rounded"
                />
              </div>
            </div>
          </div>

          {/* Visual Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Monitor className="w-4 h-4 mr-2" />
              Visual
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700 block mb-2">Transition Effect</label>
                <select
                  value={localSettings.transition}
                  onChange={(e) => handleSettingChange('transition', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                  <option value="zoom">Zoom</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Show Controls</label>
                <input
                  type="checkbox"
                  checked={localSettings.showControls}
                  onChange={(e) => handleSettingChange('showControls', e.target.checked)}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Show Image Info</label>
                <input
                  type="checkbox"
                  checked={localSettings.showInfo}
                  onChange={(e) => handleSettingChange('showInfo', e.target.checked)}
                  className="rounded"
                />
              </div>
            </div>
          </div>

          {/* Audio Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Volume2 className="w-4 h-4 mr-2" />
              Audio
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700 block mb-2">
                  Volume: {Math.round(localSettings.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.volume}
                  onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Presets</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const preset = {
                    ...localSettings,
                    interval: 3,
                    transition: 'fade' as const,
                    autoPlay: true,
                    loop: true,
                    shuffle: false,
                  };
                  setLocalSettings(preset);
                  onSettingsChange(preset);
                }}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded hover:bg-blue-200 transition-colors"
              >
                Fast Slideshow
              </button>
              <button
                onClick={() => {
                  const preset = {
                    ...localSettings,
                    interval: 10,
                    transition: 'zoom' as const,
                    autoPlay: true,
                    loop: true,
                    shuffle: true,
                  };
                  setLocalSettings(preset);
                  onSettingsChange(preset);
                }}
                className="text-xs bg-green-100 text-green-700 px-3 py-2 rounded hover:bg-green-200 transition-colors"
              >
                Gallery Mode
              </button>
              <button
                onClick={() => {
                  const preset = {
                    ...localSettings,
                    interval: 15,
                    transition: 'slide' as const,
                    autoPlay: false,
                    loop: false,
                    shuffle: false,
                    showControls: true,
                    showInfo: true,
                  };
                  setLocalSettings(preset);
                  onSettingsChange(preset);
                }}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded hover:bg-purple-200 transition-colors"
              >
                Manual Mode
              </button>
              <button
                onClick={() => {
                  const preset = {
                    ...localSettings,
                    interval: 5,
                    transition: 'fade' as const,
                    autoPlay: true,
                    loop: true,
                    shuffle: false,
                    showControls: false,
                    showInfo: false,
                  };
                  setLocalSettings(preset);
                  onSettingsChange(preset);
                }}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 transition-colors"
              >
                Kiosk Mode
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Keyboard Shortcuts</h4>
            <div className="text-xs space-y-1 text-gray-600 bg-gray-50 p-3 rounded">
              <div className="flex justify-between">
                <span>← →</span>
                <span>Navigate</span>
              </div>
              <div className="flex justify-between">
                <span>Space</span>
                <span>Next</span>
              </div>
              <div className="flex justify-between">
                <span>P</span>
                <span>Play/Pause</span>
              </div>
              <div className="flex justify-between">
                <span>F</span>
                <span>Fullscreen</span>
              </div>
              <div className="flex justify-between">
                <span>S</span>
                <span>Settings</span>
              </div>
              <div className="flex justify-between">
                <span>I</span>
                <span>Toggle Info</span>
              </div>
              <div className="flex justify-between">
                <span>C</span>
                <span>Toggle Controls</span>
              </div>
              <div className="flex justify-between">
                <span>Esc</span>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Reset to Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlideshowSettings;






