const { spawn } = require('child_process');
const path = require('path');

let daemonProcess = null;
let daemonStopping = false;

function startAnalysisDaemon() {
  if (process.env.DISABLE_ANALYSIS_DAEMON === 'true') {
    console.log('[analysis] Analysis daemon disabled via DISABLE_ANALYSIS_DAEMON=true');
    return null;
  }

  if (daemonProcess && !daemonProcess.killed && daemonProcess.exitCode === null) {
    return daemonProcess;
  }

  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'analysisDaemon.js');
  daemonStopping = false;
  daemonProcess = spawn(process.execPath, [scriptPath], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  });

  daemonProcess.on('exit', (code, signal) => {
    daemonProcess = null;
    if (daemonStopping) return;
    console.warn(
      `[analysis] Analysis daemon exited unexpectedly (code=${code}, signal=${signal}). Restarting...`
    );
    setTimeout(() => startAnalysisDaemon(), 2000);
  });

  daemonProcess.on('error', (error) => {
    console.error(`[analysis] Failed to start analysis daemon: ${error.message}`);
    daemonProcess = null;
  });

  console.log(`[analysis] Analysis daemon started (pid ${daemonProcess.pid})`);
  return daemonProcess;
}

function stopAnalysisDaemon() {
  daemonStopping = true;
  if (daemonProcess && !daemonProcess.killed) {
    daemonProcess.kill('SIGTERM');
  }
}

module.exports = {
  startAnalysisDaemon,
  stopAnalysisDaemon,
  getAnalysisDaemonProcess: () => daemonProcess,
};
