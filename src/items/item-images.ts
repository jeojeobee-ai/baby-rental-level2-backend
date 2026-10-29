// 대표 사진은 업로드 없이 프론트엔드 public/items/ 에 있는 데모 그림 중에서만 고릅니다.
// 프론트엔드 src/lib/labels.ts 의 IMAGE_OPTIONS 와 같은 목록이어야 합니다.
export const ITEM_IMAGES = [
  'stroller',
  'car-seat',
  'carrier',
  'crib',
  'mattress',
  'sterilizer',
  'bath',
  'kettle',
  'food-maker',
  'high-chair',
  'walker',
  'activity-center',
  'bouncer',
  'play-gym',
  'play-house',
].map((name) => `/items/${name}.svg`);
