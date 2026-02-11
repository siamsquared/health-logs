import { useState, useEffect, useRef } from 'react';
import ReactCropper, { ReactCropperElement } from 'react-cropper';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { X, RotateCw, Trash2, Check, Crop as CropIcon, Plus } from 'lucide-react';

interface ImagePreviewModalProps {
    isOpen: boolean;
    files: File[];
    onClose: () => void;
    onConfirm: (processedFiles: File[]) => void;
}

interface ImageState {
    file: File;
    preview: string;
    cropData?: Cropper.Data;
}

export default function ImagePreviewModal({ isOpen, files, onClose, onConfirm }: ImagePreviewModalProps) {
    const [images, setImages] = useState<ImageState[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const cropperRef = useRef<ReactCropperElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize state
    useEffect(() => {
        if (files && files.length > 0 && images.length === 0) {
            const newImages = files.map(file => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            setImages(newImages);
            setCurrentIndex(0);
        }
    }, [files]);

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            setImages([]);
            setCurrentIndex(0);
        }
    }, [isOpen]);

    const currentImage = images[currentIndex];

    // Helper to capture data before switching
    const captureCropData = () => {
        if (cropperRef.current?.cropper && currentImage) {
            const data = cropperRef.current.cropper.getData();
            setImages(prev => {
                const newImgs = [...prev];
                newImgs[currentIndex] = { ...newImgs[currentIndex], cropData: data };
                return newImgs;
            });
        }
    };

    const handleThumbnailClick = (index: number) => {
        captureCropData();
        setCurrentIndex(index);
    };

    const handleDelete = () => {
        if (images.length === 1) {
            onClose();
        } else {
            setImages(prev => {
                const newImages = prev.filter((_, i) => i !== currentIndex);
                return newImages;
            });
            if (currentIndex >= images.length - 1) {
                setCurrentIndex(Math.max(0, images.length - 2));
            }
        }
    };

    const handleRotate = () => {
        cropperRef.current?.cropper.rotate(90);
    };

    const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newImageStates = newFiles.map(file => ({
                file,
                preview: URL.createObjectURL(file),
            }));

            captureCropData();

            setImages(prev => [...prev, ...newImageStates]);
            setCurrentIndex(images.length);

            e.target.value = "";
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            // Capture current active data
            let activeData: Cropper.Data | undefined;
            if (cropperRef.current?.cropper) {
                activeData = cropperRef.current.cropper.getData();
            }

            const processedFiles: File[] = [];

            for (let i = 0; i < images.length; i++) {
                const imgState = images[i];
                const data = (i === currentIndex) ? activeData : imgState.cropData;

                if (!data) {
                    processedFiles.push(imgState.file);
                    continue;
                }

                // For current image, assume usage of active cropper is fastest/safest?
                // Actually, to be consistent, we can just use the offscreen helper for all?
                // Or use active cropper for current one.
                if (i === currentIndex && cropperRef.current?.cropper) {
                    const canvas = cropperRef.current.cropper.getCroppedCanvas();
                    if (canvas) {
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg'));
                        if (blob) {
                            processedFiles.push(new File([blob], imgState.file.name, { type: 'image/jpeg' }));
                        } else {
                            processedFiles.push(imgState.file);
                        }
                    } else {
                        processedFiles.push(imgState.file);
                    }
                    continue;
                }

                // Off-screen processing for others
                const processed = await processImageOffScreen(imgState.preview, data, imgState.file.name);
                processedFiles.push(processed || imgState.file);
            }

            onConfirm(processedFiles);
        } catch (e) {
            console.error("Processing failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen || !currentImage) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">

                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <CropIcon size={20} />
                        ปรับแต่งรูปภาพ ({currentIndex + 1}/{images.length})
                    </h3>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#F5F5F7]">

                    {/* Sidebar Thumbnails (Desktop) */}
                    <div className="hidden md:flex flex-col w-24 bg-white border-r border-gray-200 overflow-y-auto shrink-0 p-2 gap-2">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleThumbnailClick(idx)}
                                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${currentIndex === idx ? 'border-black' : 'border-transparent hover:border-gray-200'}`}
                            >
                                <img src={img.preview} className="w-full h-full object-cover" />
                                {idx === currentIndex && <div className="absolute inset-0 bg-black/10" />}
                            </div>
                        ))}
                        <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 flex flex-col items-center justify-center cursor-pointer transition-all gap-1 text-gray-400 hover:text-black">
                            <Plus size={20} />
                            <span className="text-[10px] font-bold">เพิ่ม</span>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleAddImages}
                            />
                        </label>
                    </div>

                    {/* Cropper Container */}
                    <div className="flex-1 relative flex flex-col min-w-0">
                        <div className="flex-1 relative bg-[#2a2a2a] overflow-hidden">
                            <ReactCropper
                                src={currentImage.preview}
                                style={{ height: '100%', width: '100%' }}
                                initialAspectRatio={NaN}
                                aspectRatio={NaN}
                                guides={true}
                                ref={cropperRef}
                                viewMode={1}
                                dragMode="move"
                                background={false}
                                responsive={true}
                                autoCropArea={0.9}
                                checkOrientation={false}
                                data={currentImage.cropData}
                            />
                        </div>

                        {/* Mobile Thumbnails */}
                        <div className="md:hidden h-20 bg-white border-t border-gray-200 flex items-center overflow-x-auto gap-2 p-2 shrink-0">
                            {images.map((img, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleThumbnailClick(idx)}
                                    className={`relative h-16 w-16 shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${currentIndex === idx ? 'border-black' : 'border-transparent'}`}
                                >
                                    <img src={img.preview} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <label className="h-16 w-16 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer bg-gray-50 text-gray-400">
                                <Plus size={20} />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleAddImages}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRotate}
                                className="p-3 text-gray-600 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                                title="Rotate 90°"
                            >
                                <RotateCw size={20} />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-3 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                                title="Remove Image"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>

                        <div className="text-xs text-gray-400 font-medium hidden sm:block">
                            Drag corners to resize • Drag image to move
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <div key="processing-text" className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>กำลังประมวลผล...</span>
                                    </div>
                                ) : (
                                    <div key="confirm-text" className="flex items-center gap-2">
                                        <Check size={20} />
                                        <span>ยืนยัน ({images.length})</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Utility to process off-screen images using CropperJS
async function processImageOffScreen(src: string, data: Cropper.Data, fileName: string): Promise<File | null> {
    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = src;

        const container = document.createElement('div');
        container.style.visibility = 'hidden';
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        document.body.appendChild(container);
        container.appendChild(img);

        let cropper: Cropper | null = null;

        // Wait for image load
        img.onload = () => {
            cropper = new Cropper(img, {
                data: data,
                viewMode: 1,
                checkOrientation: false,
                ready() {
                    if (!cropper) return;
                    const canvas = cropper.getCroppedCanvas();
                    if (canvas) {
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(new File([blob], fileName, { type: 'image/jpeg' }));
                            } else {
                                resolve(null);
                            }
                            cropper?.destroy();
                            if (document.body.contains(container)) {
                                document.body.removeChild(container);
                            }
                        }, 'image/jpeg');
                    } else {
                        resolve(null);
                        cropper.destroy();
                        if (document.body.contains(container)) {
                            document.body.removeChild(container);
                        }
                    }
                }
            });
        };

        img.onerror = () => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            resolve(null);
        }
    });
}
