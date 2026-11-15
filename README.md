# Lunar Landing Site Navigator
 
NASA Space Apps 2026. Challenge: *Lunar Landing Site Navigator*.
 
Pick a spot on the Moon and a date range. See when the Sun (power) and Earth (direct-to-Earth comms) are above the real terrain horizon, quantified, and compare sites. Then go one step further: find which site and date combinations actually work for a mission, and how robust they are to landing error.
 
See [doc/scope.md](doc/scope.md) for the full plan: scope, user interaction, data sources and model.

## Backend with Docker

Prepare the offline datasets once before building (downloaded data is ignored by git):

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/fetch_data.py kernels
.venv/bin/python scripts/fetch_data.py dems
```

Build and start the API from `backend/`:

```bash
docker build -t lunar-backend .
docker run --rm -p 8000:8000 lunar-backend
```

The image includes the kernels and both prepared GeoTIFFs; raw DEM downloads and
the local virtual environment are excluded. The build rewrites `meta.tm` for the
container path. Running the image needs no dataset downloads or volume mounts.
For a different listening port, use `docker run --rm -e PORT=8080 -p 8080:8080 lunar-backend`.
Set `FRONTEND_ORIGINS` to a comma-separated list of hosted frontend origins when needed.

Verify the running API:

```bash
curl --fail http://localhost:8000/sites
curl --fail http://localhost:8000/analyze \
  -H 'Content-Type: application/json' \
  -d '{"lat":-89.45,"lon":222.7,"startDate":"2027-01-01","days":2,"stepHours":1}'
```

Interactive API documentation is available at <http://localhost:8000/docs>.
