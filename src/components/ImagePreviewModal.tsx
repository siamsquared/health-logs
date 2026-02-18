import { useState, useEffect, useRef } from 'react';
import ReactCropper, { ReactCropperElement } from 'react-cropper';
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
}

export default function ImagePreviewModal({ isOpen, files, onClose, onConfirm }: ImagePreviewModalProps) {
    const [images, setImages] = useState<ImageState[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isCropping, setIsCropping] = useState(false);
    const cropperRef = useRef<ReactCropperElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize images when modal opens, cleanup when closed
    useEffect(() => {
        if (isOpen && files && files.length > 0) {
            const newImages = files.map(file => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            setImages(newImages);
            setCurrentIndex(0);
            setIsCropping(false);
        }
        if (!isOpen) {
            setImages(prev => {
                prev.forEach(img => URL.revokeObjectURL(img.preview));
                return [];
            });
            setCurrentIndex(0);
            setIsCropping(false);
        }
    }, [isOpen, files]);

    const currentImage = images[currentIndex];

    const handleThumbnailClick = (index: number) => {
        if (isCropping) return;
        setCurrentIndex(index);
    };

    const handleDelete = () => {
        if (isCropping) return;
        if (images.length === 1) {
            onClose();
        } else {
            URL.revokeObjectURL(images[currentIndex].preview);
            setImages(prev => prev.filter((_, i) => i !== currentIndex));
            if (currentIndex >= images.length - 1) {
                setCurrentIndex(Math.max(0, images.length - 2));
            }
        }
    };

    const handleStartCrop = () => {
        setIsCropping(true);
    };

    const handleCancelCrop = () => {
        setIsCropping(false);
    };

    const handleRotate = () => {
        cropperRef.current?.cropper.rotate(90);
    };

    const handleApplyCrop = async () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg'));
        if (!blob) return;

        const croppedFile = new File([blob], currentImage.file.name, { type: 'image/jpeg' });
        const croppedPreview = URL.createObjectURL(croppedFile);

        // Revoke old preview URL
        URL.revokeObjectURL(currentImage.preview);

        setImages(prev => {
            const updated = [...prev];
            updated[currentIndex] = { file: croppedFile, preview: croppedPreview };
            return updated;
        });
        setIsCropping(false);
    };

    const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isCropping) return;
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newImageStates = newFiles.map(file => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            setImages(prev => [...prev, ...newImageStates]);
            setCurrentIndex(images.length);
            e.target.value = "";
        }
    };

    const handleConfirm = () => {
        if (isCropping) return;
        onConfirm(images.map(img => img.file));
    };

    if (!isOpen || !currentImage) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <CropIcon size={20} />
                        {isCropping
                            ? 'ครอปรูปภาพ'
                            : `ปรับแต่งรูปภาพ (${currentIndex + 1}/${images.length})`
                        }
                    </h3>
                    <button
                        onClick={isCropping ? handleCancelCrop : onClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#F5F5F7]">

                    {/* Sidebar Thumbnails (Desktop) — hidden during cropping */}
                    {!isCropping && (
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
                    )}

                    {/* Image / Cropper Container */}
                    <div className="flex-1 relative flex flex-col min-w-0">
                        <div className="flex-1 relative bg-[#2a2a2a] overflow-hidden flex items-center justify-center">
                            {isCropping ? (
                                <ReactCropper
                                    key={currentImage.preview}
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
                                />
                            ) : (
                                <img
                                    src={currentImage.preview}
                                    className="max-h-full max-w-full object-contain"
                                    alt="Preview"
                                />
                            )}
                        </div>

                        {/* Mobile Thumbnails — hidden during cropping */}
                        {!isCropping && (
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
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0 z-10">
                    {isCropping ? (
                        /* Crop mode toolbar */
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRotate}
                                    className="p-3 text-gray-600 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                                    title="Rotate 90°"
                                >
                                    <RotateCw size={20} />
                                </button>
                            </div>

                            <div className="text-xs text-gray-400 font-medium hidden sm:block">
                                ลากมุมเพื่อปรับขนาด • ลากรูปเพื่อเลื่อน
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCancelCrop}
                                    className="px-6 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleApplyCrop}
                                    className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                                >
                                    <Check size={20} />
                                    <span>ตกลง</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Preview mode toolbar */
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleStartCrop}
                                    className="p-3 text-gray-600 hover:text-black bg-gray-50 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-2"
                                    title="Crop Image"
                                >
                                    <CropIcon size={20} />
                                    <span className="text-sm font-medium hidden sm:inline">ครอป</span>
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="p-3 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                                    title="Remove Image"
                                >
                                    <Trash2 size={20} />
                                </button>
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
                                    className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                                >
                                    <Check size={20} />
                                    <span>ยืนยัน ({images.length})</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
