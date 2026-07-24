FROM node:20-bookworm-slim

# The analysis pipeline shells out to a Python CV stack (ultralytics/torch/
# opencv/easyocr), so this image needs both a Node and a Python runtime.
# opencv-python needs a few system libs it doesn't vendor on slim/bookworm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Python dependencies, in their own venv so they don't fight the system
# Python's package manager. This layer is cached separately from the Node
# install above and from the application code copy below, so an app-code
# change doesn't force a ~2GB torch/ultralytics reinstall.
COPY requirements.txt requirements-easyocr.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# ultralytics/easyocr pull in torch, and pip's default resolver picks the
# CUDA-enabled build (multi-GB, including a full cuDNN/cuBLAS toolkit) even
# though nothing in this codebase uses a GPU — video_analyzer.py never
# requests a CUDA device. Installing the CPU-only build from PyTorch's own
# index first means pip sees torch as already satisfied when it later
# resolves ultralytics's dependency on it, instead of pulling the much
# larger default wheel.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
# easyocr is installed separately, with --no-deps, so pip never resolves
# its opencv-python-headless dependency at all — that package collides
# with opencv-python's cv2 namespace badly enough that even uninstalling
# it afterward corrupts the shared install (see requirements-easyocr.txt
# for the full story). requirements.txt already covers every real
# dependency easyocr needs at runtime.
RUN pip install --no-cache-dir --no-deps -r requirements-easyocr.txt \
    && python3 -c "import cv2; assert hasattr(cv2, 'VideoCapture'), 'cv2 install broken'" \
    && python3 -c "import easyocr" \
    && python3 -c "import torch; print('torch', torch.__version__, '- CUDA build:', torch.version.cuda is not None)"

# Application code
COPY . .

# analysisController.js resolves these via env vars in containerized
# deployments (see its PROJECT_ROOT comment) since only server/ is copied
# into the image, not the full repo checkout that local dev assumes.
ENV PYTHON_BIN=/opt/venv/bin/python3
ENV CV_DIR=/app/cv
ENV TMP_ANALYSIS_DIR=/app/tmp_analysis
ENV UPLOAD_DIR=/app/uploads

RUN mkdir -p /app/uploads /app/tmp_analysis

EXPOSE 5000

CMD ["node", "server.js"]
