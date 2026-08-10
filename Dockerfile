FROM node:20-bookworm-slim AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/. ./
RUN npm run build

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/requirements.txt server/requirements-easyocr.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --no-deps -r requirements-easyocr.txt \
    && python3 -c "import cv2; assert hasattr(cv2, 'VideoCapture'), 'cv2 install broken'" \
    && python3 -c "import easyocr" \
    && python3 -c "import torch; print('torch', torch.__version__, '- CUDA build:', torch.version.cuda is not None)"

COPY server/. ./
COPY --from=client-build /app/client/build /app/client/build

RUN cd cv && python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); YOLO('yolov8n-pose.pt')"

ENV PYTHON_BIN=/opt/venv/bin/python3
ENV CV_DIR=/app/server/cv
ENV TMP_ANALYSIS_DIR=/app/server/tmp_analysis
ENV UPLOAD_DIR=/app/server/uploads

RUN mkdir -p /app/server/uploads /app/server/tmp_analysis

EXPOSE 5000

CMD ["node", "server.js"]
