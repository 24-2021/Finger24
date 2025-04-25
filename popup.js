document.addEventListener('DOMContentLoaded', function() {
  // 初始扫描
  scanCurrentPage();
  
  // 添加刷新按钮事件监听
  document.getElementById('refreshBtn').addEventListener('click', function() {
    document.getElementById('results').innerHTML = '<div class="loading">正在重新扫描</div>';
    scanCurrentPage();
  });
  
  // 标签页切换
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // 移除所有active类
      tabs.forEach(t => t.classList.remove('active'));
      // 添加当前active类
      this.classList.add('active');
      
      // 隐藏所有内容
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // 显示当前内容
      const tabName = this.getAttribute('data-tab');
      document.getElementById(tabName + '-tab').style.display = 'block';
    });
  });
  
  // 添加关键词按钮
  document.getElementById('addKeywordBtn').addEventListener('click', function() {
    addKeywordField();
  });
  
  // 表单提交
  document.getElementById('addFingerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveFingerprint();
  });
  
  // 添加导出按钮事件监听
  document.getElementById('exportBtn').addEventListener('click', function() {
    exportFingerprints();
  });
});

function showLoading() {
  document.getElementById('results').innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在扫描中...</div>
    </div>
  `;
}

function scanCurrentPage() {
  showLoading();
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN_PAGE'}, function(response) {
      if (response && response.matches) {
        displayResults(response.matches);
      } else {
        // 如果没有收到响应，可能是因为内容脚本尚未加载
        // 尝试注入并执行内容脚本
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        }, function() {
          // 脚本注入后再次尝试获取结果
          setTimeout(function() {
            chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN_PAGE'}, function(response) {
              if (response && response.matches) {
                displayResults(response.matches);
              } else {
                document.getElementById('results').innerHTML = '<div class="no-match">扫描失败，请刷新页面后重试</div>';
              }
            });
          }, 500);
        });
      }
    });
  });
}

function displayResults(matches) {
  const resultsDiv = document.getElementById('results');
  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div class="no-match">未发现匹配项</div>';
    return;
  }

  const html = matches.map(match => `
    <div class="result-item ${match.isImportant ? 'important' : ''}">
      <strong>${match.cms}</strong>
      <span class="type-label">[${match.type !== '-' ? match.type : '未分类'}]</span>
      <div>匹配方式: ${match.method === 'keyword' ? '关键词' : 'Favicon哈希'}</div>
      <div>匹配位置: ${match.location}</div>
    </div>
  `).join('');
  
  resultsDiv.innerHTML = html;
}

// 在刷新按钮点击事件中也使用新的加载动画
document.getElementById('refreshBtn').addEventListener('click', function() {
  showLoading();
  scanCurrentPage();
});

// 添加关键词输入框
function addKeywordField() {
  const container = document.getElementById('keywordContainer');
  const keywordItems = container.querySelectorAll('.keyword-item');
  
  // 启用所有删除按钮
  keywordItems.forEach(item => {
    const removeBtn = item.querySelector('.remove-keyword');
    removeBtn.disabled = false;
    removeBtn.addEventListener('click', function() {
      item.remove();
      // 如果只剩一个关键词，禁用其删除按钮
      const remainingItems = container.querySelectorAll('.keyword-item');
      if (remainingItems.length === 1) {
        remainingItems[0].querySelector('.remove-keyword').disabled = true;
      }
    });
  });
  
  // 创建新的关键词输入框
  const newItem = document.createElement('div');
  newItem.className = 'keyword-item';
  newItem.innerHTML = `
    <input type="text" class="form-control keyword-input" required>
    <button type="button" class="btn btn-secondary remove-keyword">-</button>
  `;
  
  // 添加删除按钮事件
  const removeBtn = newItem.querySelector('.remove-keyword');
  removeBtn.addEventListener('click', function() {
    newItem.remove();
    // 如果只剩一个关键词，禁用其删除按钮
    const remainingItems = container.querySelectorAll('.keyword-item');
    if (remainingItems.length === 1) {
      remainingItems[0].querySelector('.remove-keyword').disabled = true;
    }
  });
  
  container.appendChild(newItem);
}

// 保存指纹
// 保存指纹
function saveFingerprint() {
  // 获取表单数据
  const cms = document.getElementById('cms').value;
  const method = document.getElementById('method').value;
  const location = document.getElementById('location').value;
  const type = document.getElementById('type').value;
  const isImportant = document.getElementById('isImportant').checked;
  
  // 获取所有关键词
  const keywordInputs = document.querySelectorAll('.keyword-input');
  const keywords = Array.from(keywordInputs).map(input => input.value).filter(value => value.trim() !== '');
  
  if (keywords.length === 0) {
    alert('请至少添加一个关键词');
    return;
  }
  
  // 创建新指纹对象
  const newFingerprint = {
    cms: cms,
    method: method,
    location: location,
    keyword: keywords,
    isImportant: isImportant,
    type: type
  };
  
  // 获取现有的自定义指纹
  chrome.storage.local.get(['customFingerprints'], function(result) {
    let customFingerprints = result.customFingerprints || [];
    
    // 添加新指纹到自定义指纹列表
    customFingerprints.push(newFingerprint);
    
    // 保存更新后的自定义指纹列表
    chrome.storage.local.set({customFingerprints: customFingerprints}, function() {
      const statusDiv = document.getElementById('addStatus');
      statusDiv.innerHTML = '<div style="color: green; margin-top: 10px;">指纹添加成功！</div>';
      
      // 重置表单
      document.getElementById('addFingerForm').reset();
      const container = document.getElementById('keywordContainer');
      container.innerHTML = `
        <div class="keyword-item">
          <input type="text" class="form-control keyword-input" required>
          <button type="button" class="btn btn-secondary remove-keyword" disabled>-</button>
        </div>
      `;
      
      // 3秒后清除状态消息
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 3000);
    });
  });
}

// 导出指纹
function exportFingerprints() {
  // 获取所有指纹数据
  Promise.all([
    fetch(chrome.runtime.getURL('finger.json')).then(response => response.json()),
    new Promise(resolve => chrome.storage.local.get(['customFingerprints'], resolve))
  ])
  .then(([data, customData]) => {
    let fingerprints = data.fingerprint;
    
    // 如果有自定义指纹，合并它们
    if (customData.customFingerprints && customData.customFingerprints.length > 0) {
      fingerprints = fingerprints.concat(customData.customFingerprints);
    }
    
    // 创建导出数据
    const exportData = {
      fingerprint: fingerprints
    };
    
    // 转换为JSON字符串
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // 创建Blob对象
    const blob = new Blob([jsonString], {type: 'application/json'});
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finger_export_' + new Date().toISOString().slice(0, 10) + '.json';
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // 显示成功消息
      const statusDiv = document.getElementById('addStatus');
      statusDiv.innerHTML = '<div style="color: green; margin-top: 10px;">指纹导出成功！</div>';
      
      // 3秒后清除状态消息
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 3000);
    }, 100);
  })
  .catch(error => {
    console.error('导出指纹失败:', error);
    document.getElementById('addStatus').innerHTML = '<div style="color: red; margin-top: 10px;">导出失败，请重试</div>';
  });
}