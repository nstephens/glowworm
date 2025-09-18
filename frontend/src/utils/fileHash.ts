import * as SparkMD5 from 'spark-md5';

/**
 * Calculate MD5 hash of a file
 * @param file - The file to calculate hash for
 * @returns Promise that resolves to the MD5 hash string
 */
export const calculateFileHash = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    const chunkSize = 2097152; // 2MB chunks for better performance
    let currentChunk = 0;
    const chunks = Math.ceil(file.size / chunkSize);

    fileReader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer);
        currentChunk++;

        if (currentChunk < chunks) {
          loadNext();
        } else {
          resolve(spark.end());
        }
      }
    };

    fileReader.onerror = () => {
      reject(new Error('Failed to read file for hash calculation'));
    };

    const loadNext = () => {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      fileReader.readAsArrayBuffer(file.slice(start, end));
    };

    loadNext();
  });
};

/**
 * Calculate hash for multiple files
 * @param files - Array of files to calculate hashes for
 * @returns Promise that resolves to array of hashes in same order as files
 */
export const calculateFileHashes = async (files: File[]): Promise<string[]> => {
  const hashPromises = files.map(file => calculateFileHash(file));
  return Promise.all(hashPromises);
};
