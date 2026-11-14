# BUG-004 Global DEM GeoTIFF is georeferenced wrongly east of 180°

Status: open
Owner:
Severity: low
Affects: data pipeline (`fetch_data.py dems` output `ldem_64.tif`)

## Summary
`ldem_64.tif` claims `lon_0=0` but its pixels run from 0° to 360° starting at x = 0, so CRS-aware tools put longitudes 180°-360° off the raster.

## Description
The GeoTIFF's CRS is `+proj=eqc +lon_0=0 +R=1737400` with x bounds 0 to 2πR. In that projection, longitudes 180°-360° are negative x (-180° to 0°), which lies outside the raster. For example, Connecting Ridge (-89.45, 222.7) projects to x = -4 163 396 m, column -8788, instead of column 14252. The pixel data itself is correct.

Reproduce: `rasterio.warp.transform` a lon/lat with lon > 180 into the file's CRS, then call `ds.index(x, y)`. QGIS or GDAL warps of the file show the same shift.

The app is not affected today: `app/horizon.py` (`_GlobalMap.sample`) indexes columns as `(lon % 360) * width / 360` and ignores the CRS. Anything that relies on the GeoTIFF's georeferencing (GIS checks, future reprojection, `rasterio` sampling by coordinates) gets wrong or missing values for the eastern half.

## Intended behaviour
The CRS and transform agree with the pixel grid: either `lon_0=180` with an origin at x = -πR, which matches the PDS label's `CENTER_LONGITUDE = 180`, or keep `lon_0=0` and put the origin at x = -πR with the columns rolled by half the width.

## Where it happens
`fetch_dems()` → the global GeoTIFF's `crs` / `transform`.

## Cause
`_moon_crs("equirectangular")` sets `central_meridian 0`, while `from_origin(0.0, ...)` starts the grid at x = 0 for lon 0. The PDS label uses `CENTER_LONGITUDE = 180`.

## File
`backend/scripts/fetch_data.py:141` (`_moon_crs`) and `backend/scripts/fetch_data.py:238` (`from_origin`)

## Solution
_Filled in when the ticket is done. See "Solution section" below._
