#ifndef CAMERA_WINDOWS_H
#define CAMERA_WINDOWS_H

#ifdef __cplusplus
extern "C" {
#endif

// Initialize camera subsystem, returns number of cameras found
int camera_init(void);

// Get camera name, returns length written
int camera_get_name(int device, char* buffer, int buflen);

// Capture a frame from camera, returns JPEG data
// Caller must free the returned buffer with camera_free_buffer
int camera_capture(int device, int width, int height, int quality, 
                   unsigned char** out_data, int* out_size);

// Free buffer allocated by camera_capture
void camera_free_buffer(unsigned char* buffer);

// Cleanup camera subsystem
void camera_cleanup(void);

#ifdef __cplusplus
}
#endif

#endif // CAMERA_WINDOWS_H

