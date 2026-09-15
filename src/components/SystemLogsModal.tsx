/**
 * System Logs & Watchdog Recovery Viewer Modal
 */
import React, { useState } from 'react';
import { X, Terminal, ShieldAlert, Trash2, CheckCircle2, AlertTriangle, Info, Bug } from 'lucide-react';
import { LogMessage } from '../types';

interface SystemLogsModalProps {
  logs: LogMessage[];
  isOpen: boolean;
  onClose: () => void;
  onTriggerRecoveryTest: () => void;
  onClearLogs: () => void;
}

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({
  logs,
  isOpen,
  onClose,
  onTriggerRecoveryTest,
  onClearLogs
}) => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'success' | 'info'>('all');

  if (!isOpen) return null;

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.type === filter);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Nhật Ký Hệ Thống & Watchdog Tự Phục Hồi Lỗi
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  Watchdog Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Theo dõi sự kiện render, xoay góc camera, đóng file video và tự khởi động lại khi gặp lỗi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerRecoveryTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-xs font-semibold text-rose-300 border border-rose-800/80 transition cursor-pointer"
              title="Thử nghiệm Watchdog tự cứu lỗi"
            >
              <Bug className="w-3.5 h-3.5 text-rose-400" />
              Thử Nghiệm Phục Hồi Lỗi (Simulate Crash)
            </button>

            <button
              onClick={onClearLogs}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
              title="Xóa nhật ký"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh phân loại */}
        <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Bộ lọc:</span>
          {(['all', 'info', 'success', 'warning', 'error'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold capitalize transition cursor-pointer ${
                filter === type
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type === 'info' ? 'Thông tin' : type === 'success' ? 'Thành công' : type === 'warning' ? 'Cảnh báo' : 'Lỗi'}
            </button>
          ))}
        </div>

        {/* Danh sách Logs */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-slate-950">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Chưa có thông điệp nhật ký nào.
            </div>
          ) : (
            filteredLogs.map(log => {
              let badgeColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
              let Icon = Info;
              if (log.type === 'success') {
                badgeColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
                Icon = CheckCircle2;
              } else if (log.type === 'warning') {
                badgeColor = 'text-amber-400 border-amber-500/30 bg-amber-950/40';
                Icon = AlertTriangle;
              } else if (log.type === 'error') {
                badgeColor = 'text-rose-400 border-rose-500/30 bg-rose-950/40';
                Icon = ShieldAlert;
              }

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <span className="text-slate-500 shrink-0 select-none">
                    [{log.timestamp}]
                  </span>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold border shrink-0 flex items-center gap-1 ${badgeColor}`}
                  >
                    <Icon className="w-3 h-3" />
                    {log.type}
                  </span>

                  {log.instanceId && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 shrink-0">
                      CUỘC ĐUA #{log.instanceId.toString().padStart(2, '0')}
                    </span>
                  )}

                  <span className="text-slate-300 break-all">
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Tự động giám sát chu kỳ 500ms &bull; Watchdog không làm gián đoạn các luồng khác</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
