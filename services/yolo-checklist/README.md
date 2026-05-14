# YOLO Checklist Service

Microservico FastAPI para analisar imagens de checklist com Ultralytics YOLO.

O FROTAS chama este servico pela rota interna `POST /api/checklists/vision/process`. Essa rota gera uma URL assinada da imagem no Supabase Storage e envia para o endpoint configurado em `CHECKLIST_YOLO_ENDPOINT`.

## Rodar local

```bash
cd services/yolo-checklist
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Configure o FROTAS:

```env
CHECKLIST_YOLO_ENDPOINT=http://localhost:8000/inspect
CHECKLIST_ODOMETER_ENDPOINT=http://localhost:8000/odometer
CHECKLIST_YOLO_TOKEN=dev-yolo-token
CHECKLIST_VISION_SECRET=dev-vision-secret
```

Configure o servico:

```env
YOLO_SERVICE_TOKEN=dev-yolo-token
YOLO_MODEL_PATH=yolov8n.pt
YOLO_MODEL_NAME=yolov8n-checklist
YOLO_CONFIDENCE=0.35
YOLO_OCR_GPU=false
```

## Leitura de hodometro

O YOLO por si so detecta objetos/regioes. Para ler quilometragem, o servico usa este fluxo:

1. tenta usar o modelo YOLO para recortar classes como `odometer`, `dashboard`, `display`, `painel` ou `meter`, caso seu modelo customizado tenha essas classes;
2. se o modelo ainda for generico, usa recortes centrais da imagem;
3. roda OCR local com EasyOCR;
4. devolve `km_lido`, `confianca` e `leitura_segura`.

Teste direto:

```bash
curl -X POST http://localhost:8000/odometer ^
  -H "Authorization: Bearer dev-yolo-token" ^
  -F "foto_km=@C:\caminho\painel.jpg"
```

## Processar fila

Depois que checklists com fotos forem enviados:

```bash
curl -X POST http://localhost:3000/api/checklists/vision/process ^
  -H "Authorization: Bearer dev-vision-secret" ^
  -H "Content-Type: application/json" ^
  -d "{\"limit\":10}"
```

## Contrato

Entrada do servico:

```json
{
  "inspection_id": "uuid",
  "checklist_id": 123,
  "item_codigo": "pneus_step",
  "source_type": "item",
  "image_url": "https://signed-url"
}
```

Saida esperada pelo FROTAS:

```json
{
  "model_name": "yolov8n-checklist",
  "confidence": 0.91,
  "summary": "Deteccoes em item: tire: 2",
  "detections": [
    {
      "class_name": "tire",
      "confidence": 0.91,
      "box": { "x": 10, "y": 20, "width": 120, "height": 90 }
    }
  ]
}
```

## Docker

```bash
docker build -t frotas-yolo-checklist .
docker run --rm -p 8000:8000 ^
  -e YOLO_SERVICE_TOKEN=dev-yolo-token ^
  -e YOLO_MODEL_PATH=yolov8n.pt ^
  frotas-yolo-checklist
```

Para producao, monte um modelo treinado:

```bash
docker run --rm -p 8000:8000 ^
  -e YOLO_SERVICE_TOKEN=prod-token ^
  -e YOLO_MODEL_PATH=/models/bemol-checklist.pt ^
  -v C:\modelos-yolo:/models ^
  frotas-yolo-checklist
```
