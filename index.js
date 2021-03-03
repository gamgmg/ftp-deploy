const fs = require('fs')
const path = require('path')
const FtpClient = require('ftp')
const ftp = new FtpClient()


const config = {
  host: '', // 服务器host
  port: 21, 
  user: '',
  password: '',
  localRootPath: path.join('/to/project/path', 'dist'), // 要上传的本地文件目录地址
  remotePath: 'admin', // ftp目录地址
  uploadFileCount: 0, // 要上传文件的数量
  mkdirCount: 0, // 要创建的目录数量
  uploadFileList: [], // 要上传的文件列表
  mkdirList: [] // 要创建的目录列表
}

async function deployHandler() {
  console.log('开始读取文件')
  readFileHandler(config.localRootPath)
  config.uploadFileCount = config.uploadFileList.length
  config.mkdirCount = config.mkdirList.length
  console.log('开始创建目录')
  await mkdirHandler()
  console.log('开始上传文件')
  uploadFileHandler()
}

// 读取本地文件
function readFileHandler(path) {
  console.log('读取' + path + '目录内容')
  const files = fs.readdirSync(path)
  if (files.length) {
    for (const file of files) {
      statFile(path + '/' + file)
    }
  } else {
    console.log('没有需要上传的文件')
    ftp.end()
    process.exit()
  }
}

// 创建目录
function mkdirHandler() {
  return new Promise(resolve => {
    for (dir of config.mkdirList) {
      ftp.mkdir(dir, true, err => {
        if (err) {
          console.log('目录创建失败')
          ftp.end()
          throw err
        }
        config.mkdirCount--
        if (config.mkdirCount === 0) {
          console.log('所有目录创建完成')
          resolve()
        }
      })
    }
  })
}

// 读取文件状态
function statFile(path) {
  console.log('读取' + path + '文件状态')
  const stats = fs.statSync(path)
  const localFilePath = path
  const remoteFilePath = config.remotePath + '/' + localFilePath.replace(config.localRootPath + '/', '')
  if (stats.isDirectory()) {
    config.mkdirList.push(remoteFilePath)
    readFileHandler(localFilePath)
  } else if (stats.isFile()) {
    config.uploadFileList.push({
      localFilePath,
      remoteFilePath
    })
  }
}

// 上传文件
function uploadFileHandler() {
  for (const file of config.uploadFileList) {
    ftp.put(file.localFilePath, file.remoteFilePath, err => {
      if (err) {
        console.log('上传文件失败')
        ftp.end()
        process.exit()
      }
      config.uploadFileCount--
      console.log(`${file.localFilePath}上传成功(${config.uploadFileCount}/${config.uploadFileList.length})`)
      if (config.uploadFileCount === 0) {
        console.log('所有文件上传完毕')
        ftp.end()
        process.exit()
      }
    })
  }
}

ftp.on('ready', () => {
  console.log(config.host + '连接成功')
  console.log('开始查询旧文件列表并进行清理')
  ftp.list((err, list) => {
    if (err) {
      console.log('查询失败')
      ftp.end()
      throw err
    }
    deleteList(list)
  })
})

// 清除列表
function deleteList(list) {
  if (list.length) {
    const deleteTarget = list.find(item => item.name === config.remotePath)
    if (deleteTarget && deleteTarget.name) {
      console.log('要清除的旧数据', deleteTarget)
      ftp.rmdir(deleteTarget.name, true, err => {
        if (err) {
          console.log('目录创建失败')
          ftp.end()
          throw err
        }
        console.log('旧数据清除完毕')
        deployHandler()
      })
    } else {
      console.log('没有要清除的旧数据')
      deployHandler()
    }
  } else {
    console.log('没有要清除的旧数据')
    deployHandler()
  }
}

// 连接服务器
ftp.connect({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  secure: true,
  secureOptions: { "rejectUnauthorized": false },
  connTimeout: 1000 * 10, // 连接超时时间
  pasvTimeout: 1000 * 10, // PASV data 连接超时时间
  keepalive: 1000 * 10, // 多久发送一次请求，以保持连接
})