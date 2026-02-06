import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface NewDistrictOptions {
  districtId: string
  districtName: string
  sourceRoot: string
  force: boolean
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const idIndex = args.findIndex((arg) => arg === '--districtId')
  const nameIndex = args.findIndex((arg) => arg === '--districtName')
  const sourceIndex = args.findIndex((arg) => arg === '--sourceRoot')
  return {
    districtId: idIndex >= 0 ? args[idIndex + 1] : null,
    districtName: nameIndex >= 0 ? args[nameIndex + 1] : null,
    sourceRoot: sourceIndex >= 0 ? args[sourceIndex + 1] : null,
    force: args.includes('--force'),
  }
}

const ensureRelative = (value: string) => {
  if (path.isAbsolute(value)) {
    throw new Error('sourceRoot must be a relative path')
  }
  return value.replace(/\\/g, '/')
}

const buildConfig = (options: NewDistrictOptions) => {
  const root = ensureRelative(options.sourceRoot)
  return {
    districtId: options.districtId,
    districtName: options.districtName,
    inputs: {
      districtBounds: `${root}/district_bounds.shp`,
      redYellow: `${root}/red_yellow.shp`,
      busStops: `${root}/bus_stops.shp`,
      hydrants: `${root}/hydrants.shp`,
      road_centerlines: `${root}/road_centerlines.shp`,
      crosswalks: `${root}/crosswalks.shp`,
      sign_overrides: `${root}/sign_overrides.geojson`,
    },
    outputs: {
      generatedDir: `data/generated/${options.districtId}`,
      publicDir: `public/data/generated/${options.districtId}`,
    },
    crs: {
      default: 'EPSG:3826',
    },
    intersections: {
      snapToleranceMeters: 10,
      angleDiversityDegrees: 25,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    crosswalks: {
      bufferMeters: 6,
    },
    signOverrides: {
      matchToleranceMeters: 15,
    },
    inferredCandidates: {
      offsetMeters: 3.5,
      includeRoadClasses: [],
      excludeRoadClasses: [],
    },
    ops: {
      thresholds: {
        counts: {
          segments: 20,
          intersections: 20,
          inferredCandidates: 30,
          signOverrides: 30,
        },
        tierDistributionMaxDeltaPct: 15,
        perfRegressionMaxDeltaPct: 30,
        maxReasonCodeDeltaPct: 20,
        maxNewReasonCodePct: 5,
      },
      retention: {
        maxBackupsPerDistrict: 5,
        maxBackupAgeDays: 30,
      },
    },
  }
}

export const newDistrict = async (options: NewDistrictOptions) => {
  const configPath = path.resolve(
    'configs',
    'prod',
    `${options.districtId}.json`,
  )
  try {
    await fs.access(configPath)
    if (!options.force) {
      throw new Error(`Config already exists at ${configPath} (use --force)`)
    }
  } catch {
    // OK to write
  }

  const payload = buildConfig(options)
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  console.log(`Wrote ${configPath}`)
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.districtId || !args.districtName || !args.sourceRoot) {
    throw new Error(
      'Usage: tsx scripts/ops/newDistrict.ts --districtId <id> --districtName "<name>" --sourceRoot "data/raw/<id>"',
    )
  }
  await newDistrict({
    districtId: args.districtId,
    districtName: args.districtName,
    sourceRoot: args.sourceRoot,
    force: args.force,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
