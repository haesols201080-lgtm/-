// 작은 이벤트 버스: 시스템끼리 직접 참조하지 않고 사건으로 소통합니다.
// 예) bus.emit('tone', {n, pos}) → 수정이 메아리치고, 공명탑이 선율을 확인하고, 퀘스트가 진행됨
export class Bus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    let a = this.map.get(type);
    if (!a) { a = []; this.map.set(type, a); }
    a.push(fn);
    return () => { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  emit(type, data) {
    const a = this.map.get(type);
    if (a) for (const fn of [...a]) { try { fn(data); } catch (e) { console.error(`[bus:${type}]`, e); } }
    const any = this.map.get('*');
    if (any) for (const fn of any) fn(type, data);
  }
}
export const bus = new Bus();
