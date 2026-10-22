import argparse
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

import joblib
import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split


IMAGE_SIZE = (64, 64)
SEED = 42


def find_dataset_root(source: Path) -> Path:
    candidate = source / "Fire-Detection"
    if candidate.is_dir():
        return candidate
    if (source / "0").is_dir() and (source / "1").is_dir():
        return source
    if (source / "fire_images").is_dir() and (source / "non_fire_images").is_dir():
        return source
    for candidate in source.rglob("*"):
        if not candidate.is_dir():
            continue
        if (candidate / "0").is_dir() and (candidate / "1").is_dir():
            return candidate
        if (candidate / "fire_images").is_dir() and (candidate / "non_fire_images").is_dir():
            return candidate
    raise ValueError(
        "Dataset must contain Fire-Detection/0 and Fire-Detection/1, "
        "or fire_images and non_fire_images folders."
    )


def prepare_dataset(source: Path):
    temporary_dir = None
    if source.is_file() and source.suffix.lower() == ".zip":
        temporary_dir = Path(tempfile.mkdtemp(prefix="fire-dataset-"))
        with zipfile.ZipFile(source) as archive:
            archive.extractall(temporary_dir)
        dataset_root = find_dataset_root(temporary_dir)
    else:
        dataset_root = find_dataset_root(source)
    return dataset_root, temporary_dir


def load_images(dataset_root: Path):
    features, labels = [], []
    if (dataset_root / "0").is_dir() and (dataset_root / "1").is_dir():
        label_directories = ((0, dataset_root / "0"), (1, dataset_root / "1"))
    else:
        label_directories = ((0, dataset_root / "non_fire_images"), (1, dataset_root / "fire_images"))

    for label, label_directory in label_directories:
        for image_path in label_directory.rglob("*"):
            if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            try:
                image = Image.open(image_path).convert("RGB").resize(IMAGE_SIZE)
                features.append(np.asarray(image, dtype=np.float32).reshape(-1) / 255.0)
                labels.append(label)
            except (OSError, ValueError):
                continue
    if not features:
        raise ValueError("No supported images found in the dataset.")
    return np.asarray(features), np.asarray(labels)


def main():
    parser = argparse.ArgumentParser(description="Train the NiyanTrak fire image classifier.")
    parser.add_argument("dataset", type=Path, help="archive.zip or extracted Fire-Detection directory")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "model_artifacts")
    args = parser.parse_args()

    dataset_root, temporary_dir = prepare_dataset(args.dataset)
    try:
        features, labels = load_images(dataset_root)
        train_features, validation_features, train_labels, validation_labels = train_test_split(
            features, labels, test_size=0.2, random_state=SEED, stratify=labels
        )
        model = LogisticRegression(max_iter=300, random_state=SEED, solver="liblinear")
        model.fit(train_features, train_labels)
        accuracy = float(model.score(validation_features, validation_labels))
        args.output.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, args.output / "fire_detection_model.joblib")
        (args.output / "fire_detection_metadata.json").write_text(
            json.dumps({
                "classes": {"0": "no_fire", "1": "fire"},
                "imageSize": list(IMAGE_SIZE),
                "threshold": 0.5,
                "metrics": {"validationAccuracy": accuracy, "images": int(len(labels))},
            }, indent=2), encoding="utf-8"
        )
        print(f"Saved fire model to {args.output}")
    finally:
        if temporary_dir:
            shutil.rmtree(temporary_dir, ignore_errors=True)


if __name__ == "__main__":
    main()