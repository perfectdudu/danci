const app = getApp();

Page({
  data: {
    recordList: [] // 听写记录列表
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

  // 加载听写记录
  loadRecords: function () {
    // 如果用户已登录，从云数据库加载记录
    if (app.globalData.userInfo) {
      const db = wx.cloud.database();
      db.collection('dictationRecords')
        .where({
          _openid: app.globalData.userInfo.openId
        })
        .orderBy('createTime', 'desc') // 按创建时间降序排列
        .get()
        .then(res => {
          // 格式化日期
          const records = res.data.map(record => {
            return {
              ...record,
              date: this.formatDate(record.createTime)
            };
          });
          
          this.setData({
            recordList: records
          });
        })
        .catch(err => {
          console.error('获取听写记录失败：', err);
          wx.showToast({
            title: '加载记录失败',
            icon: 'none'
          });
        });
    } else {
      // 使用示例数据
      const exampleRecords = [
        {
          id: 'record1',
          title: '英语四级词汇',
          correctCount: 42,
          wrongCount: 8,
          totalCount: 50,
          accuracy: 84,
          date: '2023-06-15',
          words: [
            { word: 'apple', correct: true, userAnswer: 'apple', phonetic: '/ˈæpl/' },
            { word: 'banana', correct: true, userAnswer: 'banana', phonetic: '/bəˈnɑːnə/' },
            { word: 'orange', correct: false, userAnswer: 'orang', phonetic: '/ˈɒrɪndʒ/' }
          ]
        },
        {
          id: 'record2',
          title: '英语六级核心词汇',
          correctCount: 25,
          wrongCount: 5,
          totalCount: 30,
          accuracy: 83,
          date: '2023-06-10',
          words: [
            { word: 'accommodate', correct: false, userAnswer: 'acommodate', phonetic: '/əˈkɒmədeɪt/' },
            { word: 'necessary', correct: false, userAnswer: 'neccessary', phonetic: '/ˈnesəsəri/' }
          ]
        }
      ];
      
      this.setData({
        recordList: exampleRecords
      });
    }
  },

  // 格式化日期
  formatDate: function (date) {
    if (!date) return '';
    
    // 如果是字符串日期，转换为Date对象
    if (typeof date === 'string') {
      date = new Date(date);
    } else if (date.toDate) {
      // 如果是Firestore时间戳
      date = date.toDate();
    }
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 查看听写详情
  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dictation-result/index?id=${id}`
    });
  },

  // 重新听写
  retryDictation: function (e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.recordList.find(item => item.id === id);
    
    if (!record) {
      wx.showToast({
        title: '未找到记录',
        icon: 'none'
      });
      return;
    }
    
    // 提取原始单词列表
    const words = record.words.map(item => item.word);
    
    // 存入全局变量，以便听写页面使用
    app.globalData.currentDictationWords = words;
    app.globalData.currentDictationTitle = record.title;
    
    // 跳转到听写页面
    wx.navigateTo({
      url: '/pages/dictation/index'
    });
  },

  // 跳转到首页
  goToHome: function () {
    wx.switchTab({
      url: '/pages/home/index'
    });
  }
}) 