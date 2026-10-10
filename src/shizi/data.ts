export type PoseId = 'stand' | 'cheer' | 'glance'
export type ViewMode = 'overview' | 'front' | 'side' | 'top'
export type CameraShot = { mode: ViewMode; focus: number | null; revision: number }

export const features = [
  { name: '日轮鬃', en: 'SUNBURST MANE', note: '鬃毛', copy: '鬃如日轮，向光而生。', detail: '圆钝的鬃瓣一层层环住笑脸，与身体保持一致的暖橙色。转到侧面，还能看见鬃毛厚实的起伏与层次。', point: [0.9, 2.35, 0.04] as [number, number, number], camera: [1.7, 2.35, 3.8] as [number, number, number] },
  { name: '额上新', en: 'FOREHEAD TUFT', note: '额饰', copy: '额前一束，尖尖地亮着。', detail: '额头正中一束向上的毛饰，从眉间收尖，再向上舒展。独立的立体轮廓，把“新”收成一个可以被看见的记号。', point: [0, 2.63, 0.68] as [number, number, number], camera: [0.45, 2.65, 3.4] as [number, number, number] },
  { name: '笑颜', en: 'OPEN SMILE', note: '表情', copy: '圆眼亮着，舌尖带着笑。', detail: '深棕圆眼映着两点微光，小巧鼻头落在圆鼓鼓的脸颊之间。笑口里的白牙与粉舌，为原型的雕塑表情添上一点生动。', point: [0, 1.93, 0.88] as [number, number, number], camera: [0.3, 1.94, 3.85] as [number, number, number] },
  { name: '院徽', en: 'COLLEGE MARK', note: '胸口', copy: '胸口一枚，写着致新书院。', detail: '院徽沿着圆圆的前胸贴合：左侧羽叶，右侧院名。网页为原型补上这一枚白色标记，让致新书院的身份落在身影中央。', point: [0, 0.92, 0.54] as [number, number, number], camera: [0.15, 0.96, 2.85] as [number, number, number] },
  { name: '短肢', en: 'STUBBY LIMBS', note: '手脚', copy: '手短腿短，站成一团暖意。', detail: '双臂平时自然垂在身侧，欢呼时举起轻轻摇摆。短短的腿承着圆肚子，脚尖与原型的小底座一起稳稳落下。', point: [0.6, 0.76, 0.25] as [number, number, number], camera: [1.9, 0.98, 2.4] as [number, number, number] },
  { name: '尾穗', en: 'TAIL TUFT', note: '尾巴', copy: '尾尖一束暖橙，把身影收住。', detail: '细尾从背后弯出，末梢收成尖尖的一束。正面能看见它露在身侧，绕到背后，弧线与连接的位置便都清楚了。', point: [1.04, 0.78, -0.68] as [number, number, number], camera: [2.4, 1.1, -2.5] as [number, number, number] },
] as const


export const poses = {
  stand: { label: '静立', sub: '六视之静', background: '#3a332c', sun: '#fff0d0', sunPower: 2.8, ambient: 0.72, lamp: 0.4, exposure: 1.02, position: [3.4, 6.4, 4.6] as [number, number, number] },
  cheer: { label: '欢呼', sub: '举手向光', background: '#4c3b2c', sun: '#ffc48a', sunPower: 3.3, ambient: 0.88, lamp: 0.85, exposure: 1.06, position: [2.4, 7.2, 4.8] as [number, number, number] },
  glance: { label: '回望', sub: '侧面看狮', background: '#1b1926', sun: '#d5def8', sunPower: 1.45, ambient: 0.4, lamp: 1.5, exposure: 0.98, position: [-4.2, 5.4, -2.2] as [number, number, number] },
}
