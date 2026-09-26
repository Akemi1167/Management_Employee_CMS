import { downloadXlsx } from '@/lib/xlsx-workbook';

const ATTENDANCE_HEADERS_VI = [
  'STT',
  'Số ngày làm việc',
  'Ngày nhận việc (MM/DD/YYYY)',
  'Chức vụ',
  'Bộ phận',
  'Mã nhân viên',
  'Họ tên',
  'Số ngày làm thực tế',
  'Số ngày tăng ca',
  'Số ngày trong tháng',
  'Số giờ tăng ca',
  'OFF ĐẶC BIỆT',
  'Số tiền phạt',
  'Số ngày nghỉ không lương',
];

const ATTENDANCE_HEADERS_ZH = [
  '序列号',
  '入职天数',
  '入职日期',
  '岗位',
  '部门',
  '卡号',
  '姓名',
  '实到天数',
  '加班天数',
  '考勤天数',
  '加班时数',
  '特休',
  '罚',
  '请假',
];

const PAYROLL_HEADERS_VI = [
  'STT',
  'Họ tên',
  'Bộ phận',
  'Chức vụ',
  'Mã nhân viên',
  'Ngày nhận việc (MM/DD/YY)',
  'Số năm thâm niên',
  'Lương cơ bản',
  '6 tháng tăng lương',
  'Chuyển chính',
  'Tổng lương cơ bản',
  'Số ngày trong tháng',
  'Số ngày làm thực tế',
  'Số ngày tăng ca',
  'Số giờ tăng ca',
  'Lương của tháng',
  'Tiền tăng ca theo ngày',
  'Tiền tăng ca theo giờ',
  'Thâm niên',
  'Lì xì 2-9',
  'Trợ cấp trách nhiệm',
  'Hoa hồng và KPI',
  'Thưởng bộ phận',
  'Tiền phạt',
  'Phạt KPI',
  'Ứng tiền',
  'Lương thực nhận',
  'USDT',
];

const PAYROLL_HEADERS_ZH = [
  '序列号',
  '姓名',
  '部门',
  '岗位',
  '卡号',
  '入职日期',
  '工龄年数',
  '基本工资',
  '6个月调薪',
  '转正',
  '基本工资总额',
  '当月天数',
  '实际工作天数',
  '加班天数',
  '加班时间',
  '本月工资',
  '加班费按天数的计算',
  '加班时间的钱',
  '工龄',
  '利是 2-9',
  '责任津贴',
  'HOA HỒNG+KPI',
  '奖励',
  '罚款',
  'KPI处罚',
  '预付工资',
  '实际工资',
  'USDT',
];

const SAMPLE_ATTENDANCE = [
  '1',
  '22',
  '01/15/2024',
  'Nhân viên',
  'IT',
  'NV001',
  'Nguyen Van A',
  '21',
  '1',
  '22',
  '0',
  '0',
  '0',
  '0',
];

const SAMPLE_PAYROLL = [
  '1',
  'Nguyen Van A',
  'IT',
  'Nhân viên',
  'NV001',
  '01/15/24',
  '1',
  '10000000',
  '0',
  '0',
  '10000000',
  '22',
  '21',
  '1',
  '0',
  '9545455',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '9545455',
  '370',
];

export function downloadHrExcelTemplate() {
  downloadXlsx('mau-cham-cong-phat-luong.xlsx', [
    {
      name: 'chấm công + phạt',
      rows: [ATTENDANCE_HEADERS_VI, ATTENDANCE_HEADERS_ZH, SAMPLE_ATTENDANCE],
    },
    {
      name: 'lương',
      rows: [PAYROLL_HEADERS_VI, PAYROLL_HEADERS_ZH, PAYROLL_HEADERS_VI.map(() => ''), SAMPLE_PAYROLL],
    },
  ]);
}

export function downloadWalletImportTemplate() {
  downloadXlsx('mau-ma-vi.xlsx', [
    {
      name: 'ma vi',
      rows: [
        ['Mã số thẻ', 'Họ tên', 'Địa chỉ ví', 'Nền tảng', 'Mạng', 'Chủ ví'],
        [
          'NV001',
          'Nguyen Van A',
          `T${'Q'.repeat(33)}`,
          'BINANCE',
          'TRC20',
          'Nguyen Van A',
        ],
      ],
    },
  ]);
}

export function downloadEmployeeRosterTemplate() {
  downloadXlsx('mau-danh-sach-nhan-vien.xlsx', [
    {
      name: 'nhan vien',
      rows: [
        ['Mã nhân viên', 'Họ tên', 'Bộ phận', 'Chức vụ', 'Ngày nhận việc (MM/DD/YY)'],
        ['NV001', 'Nguyen Van A', 'IT', 'Nhân viên', '01/15/24'],
      ],
    },
  ]);
}
