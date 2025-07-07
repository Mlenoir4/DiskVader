export const mockScanData = {
  total_files: 15847,
  total_folders: 2134,
  total_size: 487320000000, // ~487 GB
  scan_time: 3.7,
  scan_path: "/Users/username/Documents",
  free_space: 125000000000, // ~125 GB
  used_percentage: 79.5
};

export const mockDoughnutData = [
  { name: "Videos", value: 189250000000, color: "#3b82f6" }, // ~189 GB
  { name: "Images", value: 123450000000, color: "#10b981" }, // ~123 GB
  { name: "Documents", value: 87650000000, color: "#f59e0b" }, // ~87 GB
  { name: "Music", value: 45320000000, color: "#8b5cf6" }, // ~45 GB
  { name: "Archives", value: 28100000000, color: "#ef4444" }, // ~28 GB
  { name: "Applications", value: 13550000000, color: "#6b7280" } // ~13 GB
];

export const mockTrendData = {
  "7D": [
    { name: "Mon", value: 483.2 },
    { name: "Tue", value: 484.1 },
    { name: "Wed", value: 485.3 },
    { name: "Thu", value: 486.7 },
    { name: "Fri", value: 487.1 },
    { name: "Sat", value: 487.3 },
    { name: "Sun", value: 487.3 }
  ],
  "30D": [
    { name: "Week 1", value: 478.5 },
    { name: "Week 2", value: 481.2 },
    { name: "Week 3", value: 484.8 },
    { name: "Week 4", value: 487.3 }
  ],
  "90D": [
    { name: "Jan", value: 465.2 },
    { name: "Feb", value: 471.8 },
    { name: "Mar", value: 487.3 }
  ]
};

export const mockLargestFiles = [
  {
    id: 1,
    name: "4K_Wedding_Final_Cut.mov",
    path: "/Videos/Projects/2024/Wedding",
    size: 12400000000, // ~12.4 GB
    file_type: "video",
    extension: "mov"
  },
  {
    id: 2,
    name: "MacOS_Monterey_Backup.dmg",
    path: "/Backups/System",
    size: 8700000000, // ~8.7 GB
    file_type: "archive",
    extension: "dmg"
  },
  {
    id: 3,
    name: "RAW_Photo_Collection_2024.zip",
    path: "/Photos/RAW/Archives",
    size: 6200000000, // ~6.2 GB
    file_type: "archive",
    extension: "zip"
  },
  {
    id: 4,
    name: "Photoshop_Project_Masterfile.psd",
    path: "/Design/Current_Projects",
    size: 4300000000, // ~4.3 GB
    file_type: "image",
    extension: "psd"
  },
  {
    id: 5,
    name: "Concert_Recording_Live.wav",
    path: "/Music/Recordings/2024",
    size: 3800000000, // ~3.8 GB
    file_type: "audio",
    extension: "wav"
  },
  {
    id: 6,
    name: "Database_Full_Backup_2024.sql",
    path: "/Development/Backups",
    size: 2900000000, // ~2.9 GB
    file_type: "database",
    extension: "sql"
  },
  {
    id: 7,
    name: "Virtual_Machine_Ubuntu.vmdk",
    path: "/VirtualMachines/Development",
    size: 2650000000, // ~2.65 GB
    file_type: "virtual machine",
    extension: "vmdk"
  },
  {
    id: 8,
    name: "3D_Animation_Render_Final.blend",
    path: "/3D_Projects/Blender/Current",
    size: 2100000000, // ~2.1 GB
    file_type: "3d model",
    extension: "blend"
  }
];

export const mockFolders = [
  {
    id: 1,
    name: "Videos",
    size: 189250000000,
    file_count: 2847,
    percentage: 38.8
  },
  {
    id: 2,
    name: "Photos",
    size: 123450000000,
    file_count: 8421,
    percentage: 25.3
  },
  {
    id: 3,
    name: "Documents",
    size: 87650000000,
    file_count: 3754,
    percentage: 18.0
  },
  {
    id: 4,
    name: "Music",
    size: 45320000000,
    file_count: 1247,
    percentage: 9.3
  },
  {
    id: 5,
    name: "Downloads",
    size: 28100000000,
    file_count: 543,
    percentage: 5.8
  },
  {
    id: 6,
    name: "Applications",
    size: 13550000000,
    file_count: 35,
    percentage: 2.8
  }
];

export const mockFileTypeDistribution = [
  {
    file_type: "Video Files",
    size: 189250000000,
    count: 2847,
    color: "#3b82f6"
  },
  {
    file_type: "Images",
    size: 123450000000,
    count: 8421,
    color: "#10b981"
  },
  {
    file_type: "Documents",
    size: 87650000000,
    count: 3754,
    color: "#f59e0b"
  },
  {
    file_type: "Audio Files",
    size: 45320000000,
    count: 1247,
    color: "#8b5cf6"
  },
  {
    file_type: "Archives",
    size: 28100000000,
    count: 543,
    color: "#ef4444"
  },
  {
    file_type: "Applications",
    size: 13550000000,
    count: 35,
    color: "#6b7280"
  }
];
