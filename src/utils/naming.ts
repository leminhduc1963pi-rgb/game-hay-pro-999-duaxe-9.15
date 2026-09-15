/**
 * Tiện ích đặt tên video chuẩn theo 5 tay đua nổi tiếng nhất
 */
export const FAMOUS_5_DRIVERS = [
  'Lionel Messi',
  'Cristiano Ronaldo',
  'Neymar Jr',
  'David Beckham',
  'Kylian Mbappe'
];

export const FAMOUS_5_DRIVERS_SLUG = 'Lionel_Messi_Cristiano_Ronaldo_Neymar_Jr_David_Beckham_Kylian_Mbappe';

export interface DriverGridEntry {
  rank: number;
  name: string;
  team: string;
  color: string;
  type: 'HYPER' | 'F1';
  isPlayer: boolean;
}

export const FULL_STARTING_GRID_DRIVERS: DriverGridEntry[] = [
  { rank: 1, name: 'Lionel Messi', team: 'Hyper Predator #10', color: '#dc2626', type: 'HYPER', isPlayer: true },
  { rank: 2, name: 'Cristiano Ronaldo', team: 'Phantom GT #7', color: '#2563eb', type: 'F1', isPlayer: false },
  { rank: 3, name: 'Neymar Jr.', team: 'Viper RS #11', color: '#eab308', type: 'HYPER', isPlayer: false },
  { rank: 4, name: 'David Beckham', team: 'Apex Predator #23', color: '#16a34a', type: 'F1', isPlayer: false },
  { rank: 5, name: 'Kylian Mbappé', team: 'Nebula Turbo #10', color: '#9333ea', type: 'HYPER', isPlayer: false },
  { rank: 6, name: 'Ronaldinho', team: 'Cyber Falcon #80', color: '#06b6d4', type: 'F1', isPlayer: false },
  { rank: 7, name: 'Ronaldo Nazário', team: 'Solar Flare #9', color: '#ea580c', type: 'HYPER', isPlayer: false },
  { rank: 8, name: 'Zinedine Zidane', team: 'Thunderbolt #5', color: '#ec4899', type: 'F1', isPlayer: false },
  { rank: 9, name: 'Pelé', team: 'Spectre RS #10', color: '#f59e0b', type: 'HYPER', isPlayer: false },
  { rank: 10, name: 'Zlatan Ibrahimović', team: 'Titan Hyper #11', color: '#64748b', type: 'F1', isPlayer: false },
  { rank: 11, name: 'Diego Maradona', team: 'Vortex 9 #10', color: '#0284c7', type: 'HYPER', isPlayer: false },
  { rank: 12, name: 'Thierry Henry', team: 'Zenith F1 #14', color: '#b91c1c', type: 'F1', isPlayer: false },
];

/**
 * Tạo tên file video đua xe chứa tên 5 tay đua nổi tiếng nhất theo đúng yêu cầu:
 * "đặt tên video theo tên 5 tên tay đua nổi tiếng nhất trong danh sách tay đua em nhé"
 */
export function generateFamousDriversVideoFileName(options?: {
  trackName?: string;
  ext?: string;
  date?: Date;
  customDrivers?: string[];
  suffix?: string;
}): string {
  const d = options?.date || new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  
  let driversPart = FAMOUS_5_DRIVERS_SLUG;
  if (options?.customDrivers && options.customDrivers.length >= 5) {
    driversPart = options.customDrivers
      .slice(0, 5)
      .map(name => name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''))
      .join('_');
  }

  const track = (options?.trackName || 'Monza_GP')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  
  const ext = (options?.ext || 'mp4').replace('.', '');
  const suffix = options?.suffix ? `_${options.suffix}` : '';

  return `DuaXe_${driversPart}_Chang_${track}${suffix}_${dateStr}.${ext}`;
}
