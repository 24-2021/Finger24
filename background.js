chrome.runtime.onInstalled.addListener(() => {
  console.log('网站指纹识别插件已安装');
});

// 当标签页更新时重新扫描
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // 页面加载完成后，通知内容脚本进行扫描
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' });
  }
});