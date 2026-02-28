import React from 'react';

/**
 * Display Registration Page
 *
 * Shows Pi3D setup instructions. Browser-based display has been removed
 * in favor of the more robust Pi3D daemon-based display system.
 */
const DisplayRegistration: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <img
                src="/glowworm-logo.svg"
                alt="GlowWorm Logo"
                className="w-12 h-12 object-contain"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                GlowWorm Display Setup
              </h1>
            </div>
            <p className="text-gray-600">
              Set up a Raspberry Pi as a GlowWorm display device with GPU-accelerated slideshows.
            </p>
          </div>

          {/* Pi3D Setup Instructions */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">
              Raspberry Pi Setup
            </h2>

            <div className="space-y-4">
              <div className="bg-white border border-purple-200 rounded p-4">
                <p className="font-medium text-purple-900 mb-3">1. Install GlowWorm on your Raspberry Pi:</p>
                <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono overflow-x-auto">
                  curl -sSL https://your-server/install.sh | sudo bash
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Replace "your-server" with your GlowWorm server address.
                </p>
              </div>

              <div className="bg-white border border-purple-200 rounded p-4">
                <p className="font-medium text-purple-900 mb-2">2. Enter your server URL when prompted</p>
                <p className="text-sm text-purple-700">
                  The installer will ask for your GlowWorm server URL (e.g., <code className="bg-purple-100 px-1 rounded">http://192.168.1.100:3003</code>)
                </p>
              </div>

              <div className="bg-white border border-purple-200 rounded p-4">
                <p className="font-medium text-purple-900 mb-2">3. Note the 4-character registration code</p>
                <p className="text-sm text-purple-700">
                  The Pi will display a registration code on screen. You'll need this to authorize the device.
                </p>
              </div>

              <div className="bg-white border border-purple-200 rounded p-4">
                <p className="font-medium text-purple-900 mb-2">4. Authorize in Admin Panel</p>
                <p className="text-sm text-purple-700">
                  Go to <strong>Admin → Devices</strong> and authorize the device using the registration code.
                </p>
              </div>

              <div className="bg-white border border-purple-200 rounded p-4">
                <p className="font-medium text-purple-900 mb-2">5. Assign a playlist</p>
                <p className="text-sm text-purple-700">
                  Once authorized, assign a playlist and the slideshow will start automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Pi3D Display Features</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                GPU-accelerated transitions at 30+ FPS
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Low memory usage (&lt;200MB RAM)
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Auto-restart on crash
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Offline image caching
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                WebSocket remote control
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Automatic playlist updates
              </li>
            </ul>
          </div>

          {/* Compatible Devices */}
          <div className="text-center text-sm text-gray-500">
            <p className="font-medium mb-1">Compatible Devices:</p>
            <p>Raspberry Pi 3B+, 4, or 5 with Raspberry Pi OS</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisplayRegistration;
