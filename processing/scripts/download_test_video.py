import os
import urllib.request

def download_video():
    # URL to a standard test video of people walking (used in many OpenCV/OpenVINO tutorials)
    url = "https://github.com/intel-iot-devkit/sample-videos/raw/master/people-detection.mp4"
    output_path = os.path.join(os.path.dirname(__file__), "..", "test_video.mp4")
    
    if os.path.exists(output_path):
        print(f"Video already exists at {output_path}")
        return

    print(f"Downloading test video from {url}...")
    try:
        urllib.request.urlretrieve(url, output_path)
        print(f"Successfully downloaded to {output_path}")
    except Exception as e:
        print(f"Failed to download video: {e}")

if __name__ == "__main__":
    download_video()
