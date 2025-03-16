const app = getApp();

Page({
  data: {
    hasUserInfo: false,
    dictationCount: 15,
    wordCount: 450
  },

  onLoad: function () {
    // 检查用户是否已登录
    if (app.globalData.userInfo) {
      this.setData({
        hasUserInfo: true
      });
      
      // 加载用户统计数据
      this.loadUserStats();
    }
  },

  onShow: function () {
    // 每次显示页面时更新统计数据
    if (app.globalData.userInfo) {
      this.loadUserStats();
    }
  },

  // 加载用户统计数据
  loadUserStats: function () {
    const db = wx.cloud.database();
    
    // 获取听写记录数量
    db.collection('dictationRecords')
      .where({
        _openid: app.globalData.userInfo.openId
      })
      .count()
      .then(res => {
        this.setData({
          dictationCount: res.total
        });
      })
      .catch(err => {
        console.error('获取听写记录数量失败：', err);
      });
    
    // 统计听写过的单词总数
    db.collection('dictationRecords')
      .where({
        _openid: app.globalData.userInfo.openId
      })
      .get()
      .then(res => {
        let totalWords = 0;
        res.data.forEach(record => {
          if (record.words && record.words.length) {
            totalWords += record.words.length;
          }
        });
        
        this.setData({
          wordCount: totalWords
        });
      })
      .catch(err => {
        console.error('统计单词数量失败：', err);
      });
  },

  // 获取用户信息
  getUserProfile: function () {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: res => {
        const userInfo = res.userInfo;
        
        // 保存用户信息到全局变量
        app.globalData.userInfo = userInfo;
        
        // 更新云数据库中的用户信息
        const db = wx.cloud.database();
        db.collection('users').where({
          _openid: app.globalData.openid
        }).get().then(res => {
          if (res.data.length === 0) {
            // 新用户，添加到数据库
            db.collection('users').add({
              data: {
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                gender: userInfo.gender,
                createTime: new Date()
              }
            });
          } else {
            // 更新现有用户
            db.collection('users').doc(res.data[0]._id).update({
              data: {
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                gender: userInfo.gender,
                updateTime: new Date()
              }
            });
          }
        });
        
        this.setData({
          hasUserInfo: true
        });
        
        // 加载用户统计数据
        this.loadUserStats();
      }
    });
  },

  // 导航到其他页面
  navigateToPage: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({
      url: url
    });
  },

  // 分享小程序
  shareApp: function () {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 显示反馈对话框
  showFeedback: function () {
    wx.showModal({
      title: '意见反馈',
      content: '感谢您使用单词听写助手！\n如有任何建议或问题，请发送邮件至：feedback@example.com',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 显示关于我们
  showAbout: function () {
    wx.showModal({
      title: '关于我们',
      content: '单词听写助手 v1.0.0\n一个帮助您进行单词听写练习的小工具，希望能够辅助您的英语学习！',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 用户点击右上角分享
  onShareAppMessage: function () {
    return {
      title: '单词听写助手 - 提高英语听力与拼写的好帮手',
      path: '/pages/home/index',
      imageUrl: '/images/share-img.png'
    };
  }
}) 