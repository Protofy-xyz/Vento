// Windows Camera Capture using Media Foundation
// Compiles directly into the Go binary via CGO

#define WIN32_LEAN_AND_MEAN
#define COBJMACROS

#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>
#include <wmcodecdsp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "camera.h"

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "ole32.lib")

static int g_initialized = 0;
static int g_device_count = 0;
static IMFActivate** g_devices = NULL;

extern "C" {

int camera_init(void) {
    if (g_initialized) {
        return g_device_count;
    }

    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
        return 0;
    }

    hr = MFStartup(MF_VERSION);
    if (FAILED(hr)) {
        return 0;
    }

    // Enumerate video capture devices
    IMFAttributes* pAttributes = NULL;
    hr = MFCreateAttributes(&pAttributes, 1);
    if (FAILED(hr)) {
        MFShutdown();
        return 0;
    }

    hr = pAttributes->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                               MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID);
    if (FAILED(hr)) {
        pAttributes->Release();
        MFShutdown();
        return 0;
    }

    UINT32 count = 0;
    hr = MFEnumDeviceSources(pAttributes, &g_devices, &count);
    pAttributes->Release();

    if (FAILED(hr)) {
        MFShutdown();
        return 0;
    }

    g_device_count = (int)count;
    g_initialized = 1;
    return g_device_count;
}

int camera_get_name(int device, char* buffer, int buflen) {
    if (!g_initialized || device < 0 || device >= g_device_count || !buffer || buflen <= 0) {
        return 0;
    }

    WCHAR* friendlyName = NULL;
    UINT32 nameLen = 0;

    HRESULT hr = g_devices[device]->GetAllocatedString(
        MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME,
        &friendlyName,
        &nameLen
    );

    if (FAILED(hr) || !friendlyName) {
        snprintf(buffer, buflen, "Camera %d", device);
        return (int)strlen(buffer);
    }

    // Convert wide string to UTF-8
    int len = WideCharToMultiByte(CP_UTF8, 0, friendlyName, -1, buffer, buflen - 1, NULL, NULL);
    CoTaskMemFree(friendlyName);

    if (len <= 0) {
        snprintf(buffer, buflen, "Camera %d", device);
        return (int)strlen(buffer);
    }

    return len - 1; // Exclude null terminator
}

// Simple JPEG encoder (baseline)
static int encode_jpeg(unsigned char* rgb, int width, int height, int quality,
                       unsigned char** out_data, int* out_size) {
    // For simplicity, we'll output raw BMP-like data that Go can convert
    // A full JPEG encoder is complex, so we'll use a simpler approach:
    // Output raw RGB data and let Go handle the JPEG encoding
    
    int data_size = width * height * 3;
    unsigned char* data = (unsigned char*)malloc(data_size + 12);
    if (!data) return 0;
    
    // Simple header: width (4 bytes), height (4 bytes), format (4 bytes = 0 for RGB)
    data[0] = (width >> 0) & 0xFF;
    data[1] = (width >> 8) & 0xFF;
    data[2] = (width >> 16) & 0xFF;
    data[3] = (width >> 24) & 0xFF;
    data[4] = (height >> 0) & 0xFF;
    data[5] = (height >> 8) & 0xFF;
    data[6] = (height >> 16) & 0xFF;
    data[7] = (height >> 24) & 0xFF;
    data[8] = 0; // Format: RGB
    data[9] = 0;
    data[10] = 0;
    data[11] = 0;
    
    memcpy(data + 12, rgb, data_size);
    
    *out_data = data;
    *out_size = data_size + 12;
    return 1;
}

int camera_capture(int device, int width, int height, int quality,
                   unsigned char** out_data, int* out_size) {
    if (!g_initialized || device < 0 || device >= g_device_count) {
        return 0;
    }

    *out_data = NULL;
    *out_size = 0;

    // Activate the device
    IMFMediaSource* pSource = NULL;
    HRESULT hr = g_devices[device]->ActivateObject(IID_PPV_ARGS(&pSource));
    if (FAILED(hr)) {
        return 0;
    }

    // Create source reader
    IMFSourceReader* pReader = NULL;
    IMFAttributes* pReaderAttrs = NULL;
    
    MFCreateAttributes(&pReaderAttrs, 1);
    if (pReaderAttrs) {
        pReaderAttrs->SetUINT32(MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, TRUE);
    }
    
    hr = MFCreateSourceReaderFromMediaSource(pSource, pReaderAttrs, &pReader);
    if (pReaderAttrs) pReaderAttrs->Release();
    
    if (FAILED(hr)) {
        pSource->Release();
        return 0;
    }

    // Configure output format to RGB32
    IMFMediaType* pType = NULL;
    hr = MFCreateMediaType(&pType);
    if (SUCCEEDED(hr)) {
        pType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
        pType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
        MFSetAttributeSize(pType, MF_MT_FRAME_SIZE, width, height);
        
        hr = pReader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, pType);
        pType->Release();
    }

    if (FAILED(hr)) {
        // Try without setting specific size
        hr = MFCreateMediaType(&pType);
        if (SUCCEEDED(hr)) {
            pType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
            pType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
            hr = pReader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, pType);
            pType->Release();
        }
    }

    // Get actual dimensions
    IMFMediaType* pCurrentType = NULL;
    hr = pReader->GetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, &pCurrentType);
    if (SUCCEEDED(hr)) {
        UINT32 actualWidth = 0, actualHeight = 0;
        MFGetAttributeSize(pCurrentType, MF_MT_FRAME_SIZE, &actualWidth, &actualHeight);
        if (actualWidth > 0) width = actualWidth;
        if (actualHeight > 0) height = actualHeight;
        pCurrentType->Release();
    }

    // Read a sample
    IMFSample* pSample = NULL;
    DWORD streamIndex, flags;
    LONGLONG timestamp;
    
    // Skip a few frames to let camera adjust
    for (int i = 0; i < 5; i++) {
        hr = pReader->ReadSample(MF_SOURCE_READER_FIRST_VIDEO_STREAM, 0,
                                  &streamIndex, &flags, &timestamp, &pSample);
        if (pSample) {
            pSample->Release();
            pSample = NULL;
        }
        if (FAILED(hr) || (flags & MF_SOURCE_READERF_ENDOFSTREAM)) break;
    }

    // Read the actual frame
    hr = pReader->ReadSample(MF_SOURCE_READER_FIRST_VIDEO_STREAM, 0,
                              &streamIndex, &flags, &timestamp, &pSample);

    int result = 0;
    if (SUCCEEDED(hr) && pSample) {
        IMFMediaBuffer* pBuffer = NULL;
        hr = pSample->ConvertToContiguousBuffer(&pBuffer);
        
        if (SUCCEEDED(hr) && pBuffer) {
            BYTE* pData = NULL;
            DWORD maxLen, currentLen;
            
            hr = pBuffer->Lock(&pData, &maxLen, &currentLen);
            if (SUCCEEDED(hr) && pData) {
                // Convert BGRA to RGB
                int rgbSize = width * height * 3;
                unsigned char* rgb = (unsigned char*)malloc(rgbSize);
                
                if (rgb) {
                    for (int y = 0; y < height; y++) {
                        for (int x = 0; x < width; x++) {
                            int srcIdx = (y * width + x) * 4;
                            int dstIdx = (y * width + x) * 3;
                            
                            if (srcIdx + 2 < (int)currentLen) {
                                rgb[dstIdx + 0] = pData[srcIdx + 2]; // R
                                rgb[dstIdx + 1] = pData[srcIdx + 1]; // G
                                rgb[dstIdx + 2] = pData[srcIdx + 0]; // B
                            }
                        }
                    }
                    
                    result = encode_jpeg(rgb, width, height, quality, out_data, out_size);
                    free(rgb);
                }
                
                pBuffer->Unlock();
            }
            pBuffer->Release();
        }
        pSample->Release();
    }

    pReader->Release();
    pSource->Release();
    
    return result;
}

void camera_free_buffer(unsigned char* buffer) {
    if (buffer) {
        free(buffer);
    }
}

void camera_cleanup(void) {
    if (!g_initialized) return;

    if (g_devices) {
        for (int i = 0; i < g_device_count; i++) {
            if (g_devices[i]) {
                g_devices[i]->Release();
            }
        }
        CoTaskMemFree(g_devices);
        g_devices = NULL;
    }

    g_device_count = 0;
    g_initialized = 0;
    MFShutdown();
}

} // extern "C"

