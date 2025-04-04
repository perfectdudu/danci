// 反馈意见页面
const app = getApp();

Page({
  data: {
    feedbackContent: '', // 反馈内容
    contactInfo: '',     // 联系方式
    submitted: false     // 是否已提交
  },

  // 输入反馈内容
  onContentInput(e) {
    this.setData({
      feedbackContent: e.detail.value
    });
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      contactInfo: e.detail.value
    });
  },
  
  // 调用反馈接口
  async feedback() {
    const result = await wx.cloud.callContainer({
      "config": {
        "env": "prod-5g5ywun6829a4db5"
      },
      "path": "/user/feedback",
      "header": {
        "X-WX-SERVICE": "word-dictation",
        "content-type": "application/json",
        "Authorization": `Bearer ${app.globalData.token}`
      },
      "method": "POST",
      "data": {
        "feedback": this.data.feedbackContent,
      }
    });
    return result;
  },
  
  // 提交反馈
  async submitFeedback() {
    const { feedbackContent } = this.data;
    
    // 内容验证
    if (!feedbackContent.trim()) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载中
    wx.showLoading({
      title: '提交中...',
      mask: true
    });
    
    try {
      // 调用反馈接口
      const result = await this.feedback();
      
      console.log('反馈提交结果:', result);
      
      // 隐藏加载
      wx.hideLoading();
      
      // 显示成功提示
      wx.showToast({
        title: '感谢您的反馈！',
        icon: 'success',
        duration: 2000
      });
      
      // 标记为已提交
      this.setData({
        submitted: true,
        feedbackContent: '',
        contactInfo: ''
      });
      
      // 2秒后重置状态
      setTimeout(() => {
        this.setData({
          submitted: false
        });
      }, 2000);
    } catch (error) {
      console.error('提交反馈失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '提交失败，请稍后再试',
        icon: 'none'
      });
    }
  }
})
