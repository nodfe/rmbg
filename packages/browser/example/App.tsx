import { useRef, useState } from 'react'
import rmbg from '@rmbg/browser'
import {
  createModnetModel,
  createSiluetaModel,
  createBriaaiModel,
  createU2netpModel
} from '../src/models'

const models: any = {
  modnet: createModnetModel('/node_modules/@rmbg/model-modnet/'),
  silueta: createSiluetaModel('/node_modules/@rmbg/model-silueta/'),
  briaai: createBriaaiModel('/node_modules/@rmbg/model-briaai/'),
  u2netp: createU2netpModel('/node_modules/@rmbg/model-u2netp/')
}

// 背景合成函数
const composeWithBackground = async (
  foregroundBlob: Blob,
  backgroundFile: File
): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    const foregroundImg = new Image()
    const backgroundImg = new Image()
    
    let loadedCount = 0
    const checkLoaded = () => {
      loadedCount++
      if (loadedCount === 2) {
        // 设置画布尺寸为前景图片尺寸
        canvas.width = foregroundImg.width
        canvas.height = foregroundImg.height
        
        // 绘制背景图片（拉伸到前景图片尺寸）
        ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height)
        
        // 绘制前景图片（透明背景的去背景图片）
        ctx.drawImage(foregroundImg, 0, 0)
        
        // 转换为Blob
        canvas.toBlob((blob) => {
          resolve(blob!)
        }, 'image/png')
      }
    }
    
    foregroundImg.onload = checkLoaded
    backgroundImg.onload = checkLoaded
    
    foregroundImg.src = URL.createObjectURL(foregroundBlob)
    backgroundImg.src = URL.createObjectURL(backgroundFile)
  })
}

function App() {
  const modelRef = useRef<HTMLSelectElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const backgroundRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLImageElement>(null)
  
  const [processedImage, setProcessedImage] = useState<Blob | null>(null)
  const [finalImage, setFinalImage] = useState<string | null>(null)
  
  const handleGenerate = () => {
    const model = models[modelRef.current?.value as string]
    const file = fileRef.current?.files?.[0]
    const log = (message: string) => {
      const logEle = logRef.current
      if (logEle) {
        logEle.innerHTML += `<p>${message}</p>`
      }
    }
    if (model && file) {
      log(`>> 0 ${performance.now()}`)
      rmbg(URL.createObjectURL(file), {
        model,
        onnx: {
          publicPath: '/node_modules/onnxruntime-web/dist/'
        },
        // runtime: '/dist/rmbg-runtime.iife.js',
        runtime: '/src/runtime.ts',
        onProgress(progress) {
          console.log(`>> ${progress}`)
        }
      })
        .then((result) => {
          log(`>>1 ${performance.now()} ${URL.createObjectURL(result)}`)
          setProcessedImage(result)
          
          // 如果已经选择了背景图片，自动合成
          const backgroundFile = backgroundRef.current?.files?.[0]
          if (backgroundFile) {
            handleComposeBackground(result, backgroundFile).catch(console.error)
          }
        })
        .catch((error) => {
          log(`>>2 ${performance.now()} - ${error.message}`)
        })
    }
  }
  
  const handleComposeBackground = async (foregroundBlob?: Blob, backgroundFile?: File) => {
    const fg = foregroundBlob || processedImage
    const bg = backgroundFile || backgroundRef.current?.files?.[0]
    
    if (fg && bg) {
      try {
        const composedBlob = await composeWithBackground(fg, bg)
        const composedUrl = URL.createObjectURL(composedBlob)
        setFinalImage(composedUrl)
        
        const log = (message: string) => {
          const logEle = logRef.current
          if (logEle) {
            logEle.innerHTML += `<p>${message}</p>`
          }
        }
        log(`>>3 背景合成完成: ${composedUrl}`)
      } catch (error) {
        console.error('背景合成失败:', error)
      }
    }
  }
  
  const handleBackgroundChange = () => {
    if (processedImage) {
      handleComposeBackground().catch(console.error)
    }
  }
  
  return (
    <>
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>背景移除与替换工具</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>1. 选择AI模型</h3>
          <select ref={modelRef} name="model" onChange={handleGenerate} style={{ padding: '8px', marginRight: '10px' }}>
            <option value="">请选择模型</option>
            <option value="modnet">modnet</option>
            <option value="silueta">silueta</option>
            <option value="briaai">briaai</option>
            <option value="u2netp">u2netp</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>2. 选择要处理的图片</h3>
          <input 
            ref={fileRef} 
            type="file" 
            accept="image/*"
            onChange={handleGenerate} 
            style={{ padding: '8px' }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>3. 选择新背景图片（可选）</h3>
          <input 
            ref={backgroundRef} 
            type="file" 
            accept="image/*"
            onChange={handleBackgroundChange}
            style={{ padding: '8px' }}
          />
        </div>
        
        {finalImage && (
          <div style={{ marginBottom: '20px' }}>
            <h3>4. 合成结果预览</h3>
            <img 
              ref={previewRef}
              src={finalImage} 
              alt="合成结果" 
              style={{ 
                maxWidth: '500px', 
                maxHeight: '400px', 
                border: '2px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }} 
            />
            <br />
            <a 
              href={finalImage} 
              download="background-replaced.png"
              style={{
                display: 'inline-block',
                marginTop: '10px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px'
              }}
            >
              下载合成图片
            </a>
          </div>
        )}
        
        <div style={{ marginTop: '30px' }}>
          <h3>处理日志</h3>
          <div 
            ref={logRef} 
            style={{ 
              border: '1px solid #ccc', 
              padding: '10px', 
              minHeight: '100px',
              backgroundColor: '#f9f9f9',
              fontFamily: 'monospace',
              fontSize: '12px'
            }} 
          />
        </div>
      </div>
    </>
  )
}

export default App
