# Fire image detection module

This module classifies an uploaded image as `fire` or `no_fire` using a
scikit-learn image classifier trained from the attached
`Fire-Detection/0` and `Fire-Detection/1` dataset structure. It also accepts
the notebook dataset structure with `fire_images` and `non_fire_images`
folders; these are mapped to `1 = fire` and `0 = no_fire`.

## Train the model

From `backend/ml`:

```powershell
python train_fire_model.py "C:\Users\kunda\Downloads\archive.zip"
```

For the `fire-detection-in-images.ipynb` dataset, extract the downloaded
dataset ZIP and pass its `fire_dataset` directory (or the ZIP itself):

```powershell
python train_fire_model.py "C:\path\to\fire_dataset"
```

The script accepts either ZIP file or extracted directory for either supported
layout. It writes
`fire_detection_model.joblib` and `fire_detection_metadata.json` to
`backend/ml/fire_detection/model_artifacts`.

## Run the image service

Install the image-service dependencies once:

```powershell
pip install -r fire_detection/requirements.txt
```

Start it from `backend/ml`:

```powershell
uvicorn fire_detection.service:app --host 0.0.0.0 --port 8002
```

The NiyanTrak Node API proxies authenticated uploads at
`POST /api/ai/detect-fire-image` using multipart field `image`.

Set `FIRE_DETECTION_SERVICE_URL` if the service is not running at
`http://localhost:8002`.