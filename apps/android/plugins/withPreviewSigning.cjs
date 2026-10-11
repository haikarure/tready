const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withPreviewSigning(config) {
  return withAppBuildGradle(config, mod => {
    const marker = '// Tready private preview signing';
    let contents = mod.modResults.contents;
    if (!contents.includes(marker)) {
      const anchor = '    signingConfigs {';
      if (!contents.includes(anchor)) throw new Error('Android signing template changed');
      contents = contents.replace(anchor, `${anchor}
        ${marker}
        treadyPreview {
            def keyPath = System.getenv('TREADY_KEYSTORE_PATH')
            def passwordPath = System.getenv('TREADY_KEYSTORE_PASSWORD_FILE')
            if (keyPath && passwordPath) {
                storeFile file(keyPath)
                storePassword new File(passwordPath).text.trim()
                keyAlias 'tready-preview'
                keyPassword new File(passwordPath).text.trim()
            }
        }`);
      const releaseAnchor = 'release {\n            // Caution!';
      if (!contents.includes(releaseAnchor)) throw new Error('Android release template changed');
      contents = contents.replace(releaseAnchor, 'release {\n            // Caution!');
      const releaseIndex = contents.indexOf('        release {');
      const debugSign = contents.indexOf('signingConfig signingConfigs.debug', releaseIndex);
      if (debugSign < 0) throw new Error('Release signing config missing');
      contents = contents.slice(0, debugSign) + 'signingConfig signingConfigs.treadyPreview' + contents.slice(debugSign + 'signingConfig signingConfigs.debug'.length);
      contents += `\n// Never associate a passkey domain with the shared template debug key.\ngradle.taskGraph.whenReady { graph ->\n    if (graph.allTasks.any { it.name == 'assembleRelease' || it.name == 'packageRelease' }) {\n        if (!System.getenv('TREADY_KEYSTORE_PATH') || !System.getenv('TREADY_KEYSTORE_PASSWORD_FILE')) {\n            throw new GradleException('Use scripts/build-android.sh to configure the private preview certificate.')\n        }\n    }\n}\n`;
    }
    mod.modResults.contents = contents;
    return mod;
  });
};
