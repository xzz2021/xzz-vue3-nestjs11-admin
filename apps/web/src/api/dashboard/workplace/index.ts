import { ok } from '../../_local'
import type { WorkplaceTotal, Project, Dynamic, Team, RadarData } from './types'

export const getCountApi = (): Promise<IResponse<WorkplaceTotal>> => {
  return ok({
    project: 40,
    access: 2340,
    todo: 10
  })
}

export const getProjectApi = (): Promise<IResponse<Project[]>> => {
  return ok([
    {
      name: 'Github',
      icon: 'github',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 2
    },
    {
      name: 'Vue',
      icon: 'code',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 5
    },
    {
      name: 'Angular',
      icon: 'cpu',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 10
    },
    {
      name: 'React',
      icon: 'refresh-cw',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 24
    },
    {
      name: 'Webpack',
      icon: 'box',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 30
    },
    {
      name: 'Vite',
      icon: 'zap',
      message: 'workplace.introduction',
      personal: 'Archer',
      time: Date.now() - 1000 * 60 * 60 * 40
    }
  ])
}

export const getDynamicApi = (): Promise<IResponse<Dynamic[]>> => {
  return ok([
    { keys: ['workplace.push', 'Archer', 'Github'], time: Date.now() - 1000 * 60 * 5 },
    { keys: ['workplace.push', 'Archer', 'Vue'], time: Date.now() - 1000 * 60 * 20 },
    { keys: ['workplace.push', 'Archer', 'Angular'], time: Date.now() - 1000 * 60 * 60 },
    { keys: ['workplace.push', 'Archer', 'React'], time: Date.now() - 1000 * 60 * 60 * 3 },
    { keys: ['workplace.push', 'Archer', 'Webpack'], time: Date.now() - 1000 * 60 * 60 * 8 },
    { keys: ['workplace.push', 'Archer', 'Vite'], time: Date.now() - 1000 * 60 * 60 * 12 }
  ])
}

export const getTeamApi = (): Promise<IResponse<Team[]>> => {
  return ok([
    { name: 'Github', icon: 'github' },
    { name: 'Vue', icon: 'code' },
    { name: 'Angular', icon: 'cpu' },
    { name: 'React', icon: 'refresh-cw' },
    { name: 'Webpack', icon: 'box' },
    { name: 'Vite', icon: 'zap' }
  ])
}

export const getRadarApi = (): Promise<IResponse<RadarData[]>> => {
  return ok([
    { name: 'workplace.quote', max: 65, personal: 60, team: 50 },
    { name: 'workplace.contribution', max: 160, personal: 120, team: 140 },
    { name: 'workplace.hot', max: 300, personal: 220, team: 250 },
    { name: 'workplace.yield', max: 130, personal: 90, team: 100 },
    { name: 'workplace.follow', max: 100, personal: 70, team: 80 }
  ])
}
