// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取传入参数
  const { word, type = 'us', speed = 1.0 } = event
  
  if (!word) {
    return {
      code: -1,
      message: '单词不能为空'
    }
  }

  try {
    // 这里使用百度翻译 API 获取单词发音，需要替换为实际的 API 密钥
    // 实际项目中应该将 API 密钥等敏感信息保存在云开发的环境变量或安全存储中
    const appid = 'YOUR_APP_ID'
    const key = 'YOUR_SECRET_KEY'
    const salt = Date.now()
    const voice = type === 'us' ? 1 : 2 // 1-美式发音 2-英式发音
    const spd = speed < 1 ? 3 : (speed > 1 ? 7 : 5) // 3-慢速 5-正常 7-快速
    
    // 获取发音 URL
    const audioUrl = `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(word)}&spd=${spd}&source=web`
    
    // 返回音频 URL，小程序端直接使用这个 URL 播放
    return {
      code: 0,
      audioUrl,
      message: 'success'
    }
  } catch (error) {
    console.error('获取单词发音失败：', error)
    return {
      code: -1,
      message: '获取发音失败：' + error.message
    }
  }
} 