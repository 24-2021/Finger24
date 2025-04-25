// 加载特征库
let fingerprints = null;

// 使用chrome.runtime.getURL获取扩展资源
Promise.all([
  fetch(chrome.runtime.getURL('finger.json')).then(response => response.json()),
  new Promise(resolve => chrome.storage.local.get(['customFingerprints'], resolve))
])
.then(([data, customData]) => {
  // 合并内置指纹和自定义指纹
  fingerprints = data.fingerprint;
  
  if (customData.customFingerprints && customData.customFingerprints.length > 0) {
    fingerprints = fingerprints.concat(customData.customFingerprints);
  }
  
  checkWebsite(fingerprints);
})
.catch(error => {
  console.error('加载指纹库失败:', error);
});

async function checkWebsite(fingerprints) {
  const matches = [];
  const pageContent = document.documentElement.innerHTML;
  const pageTitle = document.title;
  
  // 获取HTTP头信息（注意：浏览器扩展无法直接获取完整的HTTP头）
  // 这里只是一个示例，实际上需要更复杂的实现
  const headers = {};

  for (const fp of fingerprints) {
    let isMatch = false;

    if (fp.method === 'keyword') {
      if (fp.location === 'title') {
        // 标题匹配：只要包含任一关键词即匹配成功
        isMatch = fp.keyword.some(kw => pageTitle.includes(kw));
      } else if (fp.location === 'body') {
        // 内容匹配：所有关键词都要匹配才成功
        isMatch = fp.keyword.every(kw => pageContent.includes(kw));
      } else if (fp.location === 'header') {
        // 头部匹配：由于浏览器限制，这里只能做有限的匹配
        // 实际上需要更复杂的实现
        isMatch = false;
      }
    } else if (fp.method === 'icon_hash' || fp.method === 'faviconhash') {
      // Favicon哈希匹配
      const faviconHash = await getFaviconHash();
      if (faviconHash) {
        isMatch = fp.keyword.includes(faviconHash);
      }
    }

    if (isMatch) {
      matches.push({
        cms: fp.cms,
        type: fp.type || '其他',
        method: fp.method,
        location: fp.location,
        isImportant: fp.isImportant || false
      });
    }
  }

  // 存储匹配结果
  chrome.storage.local.set({matches: matches});
  return matches;
}

// 获取favicon的hash值
// 注意：这是一个简化的实现，实际上需要更复杂的哈希计算
async function getFaviconHash() {
  // 这里只是一个示例，实际上需要实现真正的favicon哈希计算
  return null;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'GET_MATCHES') {
    chrome.storage.local.get(['matches'], function(result) {
      sendResponse({matches: result.matches || []});
    });
    return true;
  } else if (request.type === 'SCAN_PAGE') {
    // 重新扫描页面
    if (fingerprints) {
      checkWebsite(fingerprints).then(matches => {
        sendResponse({matches: matches});
      });
      return true;
    } else {
      // 如果指纹库尚未加载，重新加载
      Promise.all([
        fetch(chrome.runtime.getURL('finger.json')).then(response => response.json()),
        new Promise(resolve => chrome.storage.local.get(['customFingerprints'], resolve))
      ])
      .then(([data, customData]) => {
        fingerprints = data.fingerprint;
        
        if (customData.customFingerprints && customData.customFingerprints.length > 0) {
          fingerprints = fingerprints.concat(customData.customFingerprints);
        }
        
        return checkWebsite(fingerprints);
      })
      .then(matches => {
        sendResponse({matches: matches});
      })
      .catch(error => {
        console.error('重新加载指纹库失败:', error);
        sendResponse({matches: []});
      });
      
      return true;
    }
  }
});