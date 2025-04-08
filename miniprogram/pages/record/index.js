const app = getApp();

Page({
  data: {
    recordList: [], // 听写记录列表
    loading: false // 加载状态
  },

  onLoad: function () {
    // 加载听写记录
    this.loadRecords();
  },
  
  onShow: function () {
    // 每次显示页面时更新记录
    this.loadRecords();
    
    // 更新自定义tabbar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },
  
  // 启用下拉刷新
  onPullDownRefresh: function() {
    // 加载最新记录
    this.loadRecords(true);
  },

  // 解析GMT格式时间
  parseGMTTime: function(gmtString) {
    if (!gmtString) return null;
    
    try {
      // 对于形如 "Fri, 04 Apr 2025 22:08:31 GMT" 的时间字符串
      const gmtDate = new Date(gmtString);
      if (isNaN(gmtDate.getTime())) {
        console.warn('无法解析GMT时间:', gmtString);
        return null;
      }
      return gmtDate;
    } catch (e) {
      console.error('解析GMT时间出错:', e);
      return null;
    }
  },

  // 格式化日期
  formatDate: function (gmtString) {
    if (!gmtString) return '';
    
    const date = this.parseGMTTime(gmtString);
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },
  
  // 从GMT字符串直接提取时间部分
  extractTimeFromGMT: function(gmtString) {
    if (!gmtString) return '';
    
    // 尝试匹配形如 "Fri, 04 Apr 2025 22:08:31 GMT" 中的时间部分
    const timeRegex = /(\d{2}):(\d{2}):\d{2}/;
    const match = gmtString.match(timeRegex);
    
    if (match && match.length >= 3) {
      // 提取小时和分钟
      const hours = match[1];
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    
    // 如果无法匹配，回退到使用Date对象
    try {
      const date = new Date(gmtString);
      if (!isNaN(date.getTime())) {
        return String(date.getUTCHours()).padStart(2, '0') + ':' + 
               String(date.getUTCMinutes()).padStart(2, '0');
      }
    } catch (e) {
      console.error('提取时间失败:', e);
    }
    
    return '';
  },

  // 加载听写记录
  loadRecords: function (isPullDown = false) {
    // 设置加载状态
    this.setData({ loading: true });
    
    wx.cloud.callContainer({
      "config": {
        "env": "prod-5g5ywun6829a4db5"
      },
      "path": "/record/getlist",
      "header": {
        "X-WX-SERVICE": "word-dictation",
        "content-type": "application/json",
        "Authorization": `Bearer ${app.globalData.token}`
      },
      "method": "POST",
      "data": {},
      success: (res) => {
        console.log('获取听写记录成功', res);
        
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          // 处理返回的记录数据
          const records = res.data.data || [];
          
          // 格式化记录数据
          const formattedRecords = records.map(record => {
            // 直接使用原始的GMT时间字符串
            const gmtString = record.create_time || '';
            
            // 生成日期和时间字符串
            const dateStr = this.formatDate(gmtString);
            // 直接从GMT字符串中提取时间部分，不进行时区转换
            const timeStr = this.extractTimeFromGMT(gmtString);
            
            // 输出日志用于调试
            console.log(`原始时间: ${gmtString}, 格式化后: ${dateStr} ${timeStr}`);
            
            return {
              id: record.id,
              title: record.name || '未命名记录',
              date: dateStr,
              time: timeStr,
              words: record.words ? record.words.split(',').length : 0,
              errorWords: record.error_words ? record.error_words.split(',').filter(w => w.trim()).length : 0,
              imageUrl: record.pic_url || '',
              correctRate: record.words ? Math.round(((record.words.split(',').length - (record.error_words ? record.error_words.split(',').filter(w => w.trim()).length : 0)) / record.words.split(',').length) * 100) : 0,
              serial: record.serial
            };
          });

          console.log('格式化后的记录数据', formattedRecords);
          
          this.setData({
            recordList: formattedRecords,
            loading: false
          });
        } else {
          console.error('获取听写记录失败', res);
          wx.showToast({
            title: '获取记录失败',
            icon: 'none'
          });
          this.setData({ loading: false });
        }
        
        // 如果是下拉刷新，停止下拉刷新动画
        if (isPullDown) {
          wx.stopPullDownRefresh();
        }
      },
      fail: (err) => {
        console.error('获取听写记录请求失败', err);
        wx.showToast({
          title: '网络错误，请稍后再试',
          icon: 'none'
        });
        
        this.setData({ loading: false });
        
        // 如果是下拉刷新，停止下拉刷新动画
        if (isPullDown) {
          wx.stopPullDownRefresh();
        }
      }
    });
  },

  // 查看记录详情
  viewDetail: function(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.recordList[index];
    
    // 存储当前记录到本地存储，以便在详情页获取
    const records = wx.getStorageSync('dictationRecords') || [];
    if (!records.some(r => r.serial === record.serial)) {
      records.push(record);
      wx.setStorageSync('dictationRecords', records);
    }

    // 如果有图片，存储图片URL到全局数据
    if (record.imageUrl) {
      getApp().globalData.currentImageUrl = record.imageUrl;
    }
    
    // 导航到结果详情页，并传递serial参数
    wx.navigateTo({
      url: `/pages/dictation-result/index?serial=${record.serial}`
    });
  },

  // 预览图片
  previewImage: function(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        urls: [url],
        current: url
      });
    }
  },

  // 跳转到首页
  goToHome: function () {
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  // 分享给朋友
  onShareAppMessage: function() {
    return app.shareAppMessage();
  },
  
  // 分享到朋友圈
  onShareTimeline: function() {
    return app.shareTimeline();
  }
}) 