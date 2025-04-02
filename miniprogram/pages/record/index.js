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
            const date = new Date(record.create_time);
            return {
              id: record.id,
              title: record.name || '未命名记录',
              date: this.formatDate(date),
              time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
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

  // 格式化日期
  formatDate: function (date) {
    if (!date) return '';
    
    // 如果是字符串日期，转换为Date对象
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 查看记录详情
  viewDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.recordList.find(item => item.id === id);
    if (record && record.serial) {
      wx.navigateTo({
        url: `/pages/dictation-result/index?serial=${record.serial}`
      });
    }
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
  }
}) 