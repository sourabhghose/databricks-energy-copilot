import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Zap,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Sparkles,
  Bell,
  Activity,
  ArrowRightLeft,
  BarChart2,
  Battery,
  BatteryCharging,
  Moon,
  Sun,
  Thermometer,
  DollarSign,
  Leaf,
  Brain,
  Database,
  Clock,
  Radio,
  Building2,
  Wrench,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Flame,
  Users,
  Network,
  Shield,
  Calendar,
  Gauge,
  FileText,
  Droplets,
  AlertTriangle,
  Target,
  MapPin,
  GitBranch,
  Receipt,
  Wifi,
  Wind,
  AlertOctagon,
  Heart,
} from 'lucide-react'

import Home from './pages/Home'
import LiveMarket from './pages/LiveMarket'
import Forecasts from './pages/Forecasts'
import Copilot from './pages/Copilot'
import Genie from './pages/Genie'
import Alerts from './pages/Alerts'
import Monitoring from './pages/Monitoring'
import MarketDepth from './pages/MarketDepth'
import PriceAnalysis from './pages/PriceAnalysis'
import Interconnectors from './pages/Interconnectors'
import GeneratorFleet from './pages/GeneratorFleet'
import MarketNotices from './pages/MarketNotices'
import WeatherDemand from './pages/WeatherDemand'
import BessAnalytics from './pages/BessAnalytics'
import TradingDesk from './pages/TradingDesk'
import Sustainability from './pages/Sustainability'
import MeritOrder from './pages/MeritOrder'
import MlDashboardPage from './pages/MlDashboard'
import DataCatalog from './pages/DataCatalog'
import ScenarioAnalysis from './pages/ScenarioAnalysis'
import LoadDuration from './pages/LoadDuration'
import HistoricalTrends from './pages/HistoricalTrends'
import FrequencyAnalytics from './pages/FrequencyAnalytics'
import EnergyFutures from './pages/EnergyFutures'
import ParticipantRegistry from './pages/ParticipantRegistry'
import OutageSchedule from './pages/OutageSchedule'
import DerDashboard from './pages/DerDashboard'
import Settings from './pages/Settings'
import GasMarket from './pages/GasMarket'
import RetailMarket from './pages/RetailMarket'
import NetworkAnalytics from './pages/NetworkAnalytics'
import RezInfrastructure from './pages/RezInfrastructure'
import CurtailmentAnalytics from './pages/CurtailmentAnalytics'
import DemandResponse from './pages/DemandResponse'
import SystemSecurity from './pages/SystemSecurity'
import BiddingAnalytics from './pages/BiddingAnalytics'
import NemEvents from './pages/NemEvents'
import FcasMarket from './pages/FcasMarket'
import BatteryEconomics from './pages/BatteryEconomics'
import NemSettlement from './pages/NemSettlement'
import CarbonAnalytics from './pages/CarbonAnalytics'
import HedgingAnalytics from './pages/HedgingAnalytics'
import HydroStorage from './pages/HydroStorage'
import MarketPower from './pages/MarketPower'
import PasaAnalytics from './pages/PasaAnalytics'
import SraAuction from './pages/SraAuction'
import PpaMarket from './pages/PpaMarket'
import DispatchAccuracy from './pages/DispatchAccuracy'
import RegulatoryTracker from './pages/RegulatoryTracker'
import IspTracker from './pages/IspTracker'
import SolarEvAnalytics from './pages/SolarEvAnalytics'
import LrmcAnalytics from './pages/LrmcAnalytics'
import NetworkConstraints from './pages/NetworkConstraints'
import PriceSetterAnalytics from './pages/PriceSetterAnalytics'
import TariffAnalytics from './pages/TariffAnalytics'
import GridModernisation from './pages/GridModernisation'
import WemOverview from './pages/WemOverview'
import MarketSurveillance from './pages/MarketSurveillance'
import CerDashboard from './pages/CerDashboard'
import SafeguardAnalytics from './pages/SafeguardAnalytics'
import PhesAnalytics from './pages/PhesAnalytics'
import OffshoreWind from './pages/OffshoreWind'
import CauserPays from './pages/CauserPays'
import SpotCapAnalytics from './pages/SpotCapAnalytics'
import TnspAnalytics from './pages/TnspAnalytics'
import InertiaAnalytics from './pages/InertiaAnalytics'
import HydrogenAnalytics from './pages/HydrogenAnalytics'
import TransmissionProjects from './pages/TransmissionProjects'
import DnspAnalytics from './pages/DnspAnalytics'
import VppDashboard from './pages/VppDashboard'
import MarketReformTracker from './pages/MarketReformTracker'
import TuosAnalytics from './pages/TuosAnalytics'
import CarbonRegistry from './pages/CarbonRegistry'
import EvCharging from './pages/EvCharging'
import StorageArbitrage from './pages/StorageArbitrage'
import DemandForecastAnalytics from './pages/DemandForecastAnalytics'
import RezDevelopment from './pages/RezDevelopment'
import CongestionAnalytics from './pages/CongestionAnalytics'
import EnergyEquity from './pages/EnergyEquity'
import DemandResponseAnalytics from './pages/DemandResponseAnalytics'
import BehindTheMeter from './pages/BehindTheMeter'
import RabAnalytics from './pages/RabAnalytics'
import NemRealTimeDashboard from './pages/NemRealTimeDashboard'
import RitAnalytics from './pages/RitAnalytics'
import ForwardCurveAnalytics from './pages/ForwardCurveAnalytics'
import { useDarkMode } from './hooks/useDarkMode'

const NAV_ITEMS = [
  { to: '/',             label: 'Home',         Icon: LayoutDashboard },
  { to: '/live',         label: 'Live Market',  Icon: Zap             },
  { to: '/forecasts',    label: 'Forecasts',    Icon: TrendingUp      },
  { to: '/market-depth', label: 'Market Depth', Icon: TrendingUp      },
  { to: '/copilot',      label: 'Copilot',      Icon: MessageSquare   },
  { to: '/genie',        label: 'Genie',        Icon: Sparkles        },
  { to: '/alerts',       label: 'Alerts',       Icon: Bell            },
  { to: '/monitoring',        label: 'Monitoring',     Icon: Activity        },
  { to: '/price-analysis',    label: 'Price Analysis', Icon: BarChart2       },
  { to: '/interconnectors',   label: 'Interconnectors', Icon: ArrowRightLeft },
  { to: '/generator-fleet',  label: 'Generator Fleet', Icon: Zap            },
  { to: '/market-notices',   label: 'Market Notices',   Icon: Bell           },
  { to: '/weather-demand',   label: 'Weather & Demand', Icon: Thermometer    },
  { to: '/bess',             label: 'Battery Storage',  Icon: Battery        },
  { to: '/trading-desk',    label: 'Trading Desk',     Icon: DollarSign     },
  { to: '/sustainability',  label: 'Sustainability',   Icon: Leaf            },
  { to: '/merit-order',     label: 'Merit Order',      Icon: TrendingUp      },
  { to: '/ml-dashboard',   label: 'ML Models',        Icon: Brain           },
  { to: '/data-catalog',  label: 'Data Catalog',     Icon: Database        },
  { to: '/scenario',        label: 'Scenario Analysis', Icon: Activity       },
  { to: '/load-duration',  label: 'Load Statistics',  Icon: BarChart2      },
  { to: '/trends',         label: 'Historical Trends', Icon: Clock          },
  { to: '/frequency',      label: 'Frequency',         Icon: Radio          },
  { to: '/futures',        label: 'Energy Futures',    Icon: TrendingUp     },
  { to: '/registry',       label: 'Participants',      Icon: Building2      },
  { to: '/outages',        label: 'Outage Schedule',   Icon: Wrench         },
  { to: '/der',            label: 'VPP & DER',         Icon: HomeIcon       },
  { to: '/gas',            label: 'Gas Market',        Icon: Flame          },
  { to: '/retail',         label: 'Retail Market',     Icon: Users          },
  { to: '/network',        label: 'Network & MLF',     Icon: Network        },
  { to: '/rez',            label: 'REZ & Infrastructure', Icon: Zap         },
  { to: '/curtailment',    label: 'Curtailment',       Icon: TrendingDown   },
  { to: '/dsp',            label: 'Demand Response',   Icon: Users          },
  { to: '/security',       label: 'System Security',   Icon: Shield         },
  { to: '/bidding',        label: 'Bidding Analytics', Icon: BarChart2      },
  { to: '/nem-events',     label: 'NEM Events',        Icon: Calendar       },
  { to: '/fcas-market',    label: 'FCAS Market',       Icon: Gauge          },
  { to: '/battery-econ',  label: 'Battery Economics', Icon: BatteryCharging },
  { to: '/settlement',    label: 'NEM Settlement',    Icon: FileText        },
  { to: '/carbon',        label: 'Carbon Analytics',  Icon: Leaf            },
  { to: '/hedging',       label: 'OTC Hedging',        Icon: TrendingUp     },
  { to: '/hydro',         label: 'Hydro Storage',      Icon: Droplets       },
  { to: '/market-power',  label: 'Market Power',       Icon: AlertTriangle  },
  { to: '/pasa',          label: 'PASA & Adequacy',    Icon: Activity       },
  { to: '/sra',           label: 'SRA Auctions',       Icon: ArrowRightLeft },
  { to: '/ppa',           label: 'PPA Market',         Icon: Sun            },
  { to: '/dispatch',      label: 'Dispatch Accuracy',  Icon: Target         },
  { to: '/regulatory',    label: 'Regulatory',         Icon: FileText       },
  { to: '/isp-tracker',   label: 'ISP Tracker',        Icon: MapPin         },
  { to: '/solar-ev',      label: 'Solar & EV',         Icon: Zap            },
  { to: '/lrmc',          label: 'LRMC & Investment',  Icon: TrendingDown   },
  { to: '/constraints',    label: 'Constraints',        Icon: GitBranch      },
  { to: '/price-setter',   label: 'Price Setter',       Icon: Target         },
  { to: '/tariff',         label: 'Tariff Analytics',   Icon: Receipt        },
  { to: '/grid-mod',       label: 'Grid Modernisation', Icon: Wifi           },
  { to: '/spot-cap',       label: 'Price Cap & CPT',   Icon: AlertTriangle  },
  { to: '/causer-pays',    label: 'Causer Pays',        Icon: Gauge          },
  { to: '/wem',            label: 'WEM Market',        Icon: Building2      },
  { to: '/inertia',         label: 'Inertia & Strength', Icon: Activity       },
  { to: '/tnsp',           label: 'TNSP & AER',        Icon: Network        },
  { to: '/surveillance',  label: 'Market Surveillance', Icon: Shield         },
  { to: '/hydrogen',       label: 'Green Hydrogen',    Icon: Flame          },
  { to: '/offshore-wind',  label: 'Offshore Wind',     Icon: Wind           },
  { to: '/cer',          label: 'CER & RET',       Icon: Leaf           },
  { to: '/phes',          label: 'Pumped Hydro (PHES)', Icon: Droplets       },
  { to: '/safeguard',     label: 'Safeguard & ERF',   Icon: Leaf           },
  { to: '/transmission', label: 'Major Transmission', Icon: GitBranch },
  { to: '/dnsp',           label: 'DNSP Analytics',    Icon: Network        },
  { to: '/vpp',            label: 'VPP Performance',   Icon: BatteryCharging },
  { to: '/reform',         label: 'Market Reform',     Icon: FileText       },
  { to: '/tuos',          label: 'Network Pricing',   Icon: DollarSign     },
  { to: '/carbon-registry', label: 'Carbon Registry',  Icon: Leaf           },
  { to: '/ev',            label: 'EV Charging',       Icon: Zap            },
  { to: '/storage',       label: 'Storage Arbitrage', Icon: Battery        },
  { to: '/demand-forecast', label: 'Demand Forecast', Icon: TrendingUp    },
  { to: '/rez-development', label: 'REZ Development',   Icon: MapPin         },
  { to: '/congestion',     label: 'Congestion',        Icon: AlertOctagon   },
  { to: '/equity',          label: 'Energy Equity',     Icon: Heart          },
  { to: '/demand-response', label: 'Demand Response',  Icon: Activity       },
  { to: '/btm',             label: 'Behind-the-Meter', Icon: Sun            },
  { to: '/rab',             label: 'Network RAB',      Icon: Building2      },
  { to: '/realtime',        label: 'NEM Live',         Icon: Radio          },
  { to: '/rit',             label: 'Network RIT',      Icon: GitBranch      },
  { to: '/forward-curve',   label: 'Forward Curve',    Icon: TrendingUp     },
  { to: '/settings',        label: 'Settings',         Icon: SettingsIcon   },
]

function Sidebar() {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-gray-900 dark:bg-gray-950 text-gray-100 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700">
        <Zap className="text-amber-400" size={22} />
        <span className="text-sm font-bold leading-tight tracking-tight">
          AUS Energy<br />Copilot
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
        NEM data via NEMWEB
      </div>
    </aside>
  )
}

function TopBar() {
  const [isDark, toggleDark] = useDarkMode()
  return (
    <header className="h-12 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">
        AUS Energy Copilot
      </h1>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          NEM Live
        </span>
        <span>{new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short' })} AEST</span>
        <button
          onClick={toggleDark}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-gray-500" />}
        </button>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/"          element={<Home />}       />
              <Route path="/live"      element={<LiveMarket />} />
              <Route path="/forecasts" element={<Forecasts />}  />
              <Route path="/copilot"   element={<Copilot />}    />
              <Route path="/genie"     element={<Genie />}      />
              <Route path="/alerts"        element={<Alerts />}       />
              <Route path="/monitoring"    element={<Monitoring />}   />
              <Route path="/market-depth"  element={<MarketDepth />}  />
              <Route path="/price-analysis"    element={<PriceAnalysis />}    />
              <Route path="/interconnectors"   element={<Interconnectors />}  />
              <Route path="/generator-fleet"  element={<GeneratorFleet />}   />
              <Route path="/market-notices"   element={<MarketNotices />}    />
              <Route path="/weather-demand"   element={<WeatherDemand />}    />
              <Route path="/bess"             element={<BessAnalytics />}    />
              <Route path="/trading-desk"    element={<TradingDesk />}      />
              <Route path="/sustainability" element={<Sustainability />}  />
              <Route path="/merit-order"   element={<MeritOrder />}       />
              <Route path="/ml-dashboard" element={<MlDashboardPage />}  />
              <Route path="/data-catalog" element={<DataCatalog />}       />
              <Route path="/scenario"       element={<ScenarioAnalysis />}  />
              <Route path="/load-duration" element={<LoadDuration />}      />
              <Route path="/trends"       element={<HistoricalTrends />}  />
              <Route path="/frequency"    element={<FrequencyAnalytics />} />
              <Route path="/futures"      element={<EnergyFutures />}      />
              <Route path="/registry"     element={<ParticipantRegistry />} />
              <Route path="/outages"      element={<OutageSchedule />}     />
              <Route path="/der"          element={<DerDashboard />}       />
              <Route path="/gas"          element={<GasMarket />}          />
              <Route path="/retail"       element={<RetailMarket />}       />
              <Route path="/network"      element={<NetworkAnalytics />}   />
              <Route path="/rez"          element={<RezInfrastructure />}  />
              <Route path="/curtailment"  element={<CurtailmentAnalytics />} />
              <Route path="/dsp"          element={<DemandResponse />}     />
              <Route path="/security"     element={<SystemSecurity />}     />
              <Route path="/bidding"      element={<BiddingAnalytics />}   />
              <Route path="/nem-events"   element={<NemEvents />}          />
              <Route path="/fcas-market"  element={<FcasMarket />}         />
              <Route path="/battery-econ" element={<BatteryEconomics />}  />
              <Route path="/settlement"   element={<NemSettlement />}      />
              <Route path="/carbon"       element={<CarbonAnalytics />}   />
              <Route path="/hedging"      element={<HedgingAnalytics />}  />
              <Route path="/hydro"        element={<HydroStorage />}       />
              <Route path="/market-power" element={<MarketPower />}        />
              <Route path="/pasa"         element={<PasaAnalytics />}      />
              <Route path="/sra"          element={<SraAuction />}         />
              <Route path="/ppa"          element={<PpaMarket />}          />
              <Route path="/dispatch"     element={<DispatchAccuracy />}   />
              <Route path="/regulatory"   element={<RegulatoryTracker />}  />
              <Route path="/isp-tracker"  element={<IspTracker />}         />
              <Route path="/solar-ev"     element={<SolarEvAnalytics />}   />
              <Route path="/lrmc"         element={<LrmcAnalytics />}      />
              <Route path="/constraints"  element={<NetworkConstraints />}  />
              <Route path="/price-setter" element={<PriceSetterAnalytics />} />
              <Route path="/tariff"       element={<TariffAnalytics />}    />
              <Route path="/grid-mod"     element={<GridModernisation />}  />
              <Route path="/spot-cap"      element={<SpotCapAnalytics />} />
              <Route path="/causer-pays" element={<CauserPays />}       />
              <Route path="/wem"          element={<WemOverview />}         />
              <Route path="/inertia"      element={<InertiaAnalytics />}   />
              <Route path="/tnsp"         element={<TnspAnalytics />}      />
              <Route path="/surveillance" element={<MarketSurveillance />} />
              <Route path="/hydrogen"     element={<HydrogenAnalytics />} />
              <Route path="/offshore-wind" element={<OffshoreWind />}      />
              <Route path="/cer"          element={<CerDashboard />}  />
              <Route path="/phes"         element={<PhesAnalytics />}      />
              <Route path="/safeguard"    element={<SafeguardAnalytics />} />
              <Route path="/transmission" element={<TransmissionProjects />} />
              <Route path="/dnsp"         element={<DnspAnalytics />}      />
              <Route path="/vpp"          element={<VppDashboard />}       />
              <Route path="/reform"       element={<MarketReformTracker />} />
              <Route path="/tuos"         element={<TuosAnalytics />}      />
              <Route path="/carbon-registry" element={<CarbonRegistry />}  />
              <Route path="/ev"           element={<EvCharging />}          />
              <Route path="/storage"      element={<StorageArbitrage />}    />
              <Route path="/demand-forecast" element={<DemandForecastAnalytics />} />
              <Route path="/rez-development" element={<RezDevelopment />}      />
              <Route path="/congestion"   element={<CongestionAnalytics />} />
              <Route path="/equity"           element={<EnergyEquity />}              />
              <Route path="/demand-response" element={<DemandResponseAnalytics />} />
              <Route path="/btm"            element={<BehindTheMeter />}         />
              <Route path="/rab"            element={<RabAnalytics />}           />
              <Route path="/realtime"       element={<NemRealTimeDashboard />}  />
              <Route path="/rit"            element={<RitAnalytics />}          />
              <Route path="/forward-curve"  element={<ForwardCurveAnalytics />} />
              <Route path="/settings"        element={<Settings />}              />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
