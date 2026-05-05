export interface PlaylistItem {
  title: string;
  path: string; // The file we ask IINA to play (Internal @data path)
  scanPath?: string; // The actual folder containing the media files
  count: number;
}
