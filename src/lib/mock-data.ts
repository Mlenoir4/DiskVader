export const mockScanData = {
  totalFiles: 12847,
  totalFolders: 1234,
  totalSize: 247800000000, // 247.8 GB
  scanTime: 2.4,
  scanPath: "/Users/username/Documents"
};

export const mockLargestFiles = [
  {
    id: 1,
    name: "presentation_final.mov",
    path: "/Videos/Work",
    size: 8200000000,
    type: "video",
    extension: "mov",
    modifiedAt: new Date("2024-01-15")
  },
  {
    id: 2,
    name: "backup_2025.zip",
    path: "/Documents",
    size: 5700000000,
    type: "archive",
    extension: "zip",
    modifiedAt: new Date("2024-01-10")
  },
  {
    id: 3,
    name: "raw_photos.psd",
    path: "/Photos/Projects",
    size: 3400000000,
    type: "image",
    extension: "psd",
    modifiedAt: new Date("2024-01-08")
  },
  {
    id: 4,
    name: "database_backup.sql",
    path: "/Development",
    size: 2100000000,
    type: "database",
    extension: "sql",
    modifiedAt: new Date("2024-01-05")
  }
];

export const mockFolders = [
  {
    id: 1,
    name: "Videos",
    path: "/Users/username/Documents/Videos",
    totalSize: 89200000000,
    fileCount: 1567,
    percentage: 85
  },
  {
    id: 2,
    name: "Photos",
    path: "/Users/username/Documents/Photos",
    totalSize: 67400000000,
    fileCount: 5621,
    percentage: 67
  },
  {
    id: 3,
    name: "Documents",
    path: "/Users/username/Documents/Documents",
    totalSize: 34700000000,
    fileCount: 3754,
    percentage: 34
  },
  {
    id: 4,
    name: "Applications",
    path: "/Users/username/Documents/Applications",
    totalSize: 28100000000,
    fileCount: 847,
    percentage: 28
  }
];

export const mockFileTypeDistribution = [
  { type: "Video Files", size: 89200000000, count: 1347, color: "#3b82f6" },
  { type: "Images", size: 67400000000, count: 5471, color: "#10b981" },
  { type: "Documents", size: 34700000000, count: 3754, color: "#f59e0b" },
  { type: "Archives", size: 28100000000, count: 543, color: "#8b5cf6" }
];

export const mockPieChartData = [
  { name: "Videos", value: 487.3, color: "#3b82f6" },
  { name: "Images", value: 201.8, color: "#10b981" },
  { name: "Documents", value: 158.1, color: "#f59e0b" }
];

export const mockDoughnutData = [
  { name: "Documents", value: 342.1, color: "#111827" },
  { name: "Media Files", value: 287.6, color: "#6b7280" },
  { name: "Applications", value: 156.2, color: "#9ca3af" },
  { name: "System Files", value: 43.8, color: "#d1d5db" },
  { name: "Other", value: 17.6, color: "#e5e7eb" }
];

export const mockGrowthData = [
  { name: "Jan 2025", value: 650 },
  { name: "Feb 2025", value: 720 },
  { name: "Mar 2025", value: 780 },
  { name: "Apr 2025", value: 825 },
  { name: "May 2025", value: 840 },
  { name: "Jun 2025", value: 847 }
];

export const mockTrendData = [
  { name: "Week 1", value: 820 },
  { name: "Week 2", value: 830 },
  { name: "Week 3", value: 842 },
  { name: "Week 4", value: 847 }
];

export const mockCleanupSuggestions = [
  { type: "Trash", size: 12400000000, count: 1247, selected: true },
  { type: "Downloads", size: 8700000000, count: 523, selected: true },
  { type: "Temp Files", size: 3200000000, count: 892, selected: false },
  { type: "Duplicates", size: 2100000000, count: 156, selected: false }
];

export const mockErrorData = {
  errorCode: "ERR_ACCESS_DENIED",
  timestamp: "2025-01-16 14:32:18",
  path: "/System/Library/PrivateFrameworks/",
  filesScanned: 1247,
  dataAnalyzed: 4700000000,
  scanDuration: 3.2,
  errorLogs: [
    "[2025-01-16 14:32:18] INFO: Starting disk scan for path: /",
    "[2025-01-16 14:32:18] INFO: Scanning directory: /Users/",
    "[2025-01-16 14:32:19] INFO: Processed 500 files (2.1 GB)",
    "[2025-01-16 14:32:19] INFO: Processed 1000 files (4.7 GB)",
    "[2025-01-16 14:32:19] INFO: Scanning directory: /System/Library/",
    "[2025-01-16 14:32:19] ERROR: Access denied to /System/Library/PrivateFrameworks/",
    "[2025-01-16 14:32:19] ERROR: Permission denied (errno: 13)",
    "[2025-01-16 14:32:19] ERROR: Scan terminated due to access restrictions",
    "[2025-01-16 14:32:19] INFO: Partial scan completed: 1,247 files analyzed"
  ]
};
