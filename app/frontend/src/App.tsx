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
  ShieldAlert,
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
  CloudLightning,
  Cpu,
  Atom,
  Fuel,
  TreePine,
  Car,
  Award,
  Layers,
  BookOpen,
  Tag,
  Waves,
  CircuitBoard,
  BarChart3,
  BarChart,
  SunMedium,
  Tornado,
  Factory,
  RefreshCw,
  ArrowLeftRight,
  Map,
  GitMerge,
  Globe,
  Globe2,
  ShieldCheck,
  CreditCard,
  ShoppingCart,
  Sliders,
  Power,
  Scale,
  Lock,
  Smartphone,
  Truck,
  Grid,
  Ship,
  CheckCircle,
  Monitor,
  ShoppingBag,
  Eye,
  Plug,
  PieChart,
  AlertCircle,
} from 'lucide-react'

import ElectricityMarketCompetitionConcentrationAnalytics from './pages/ElectricityMarketCompetitionConcentrationAnalytics'
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
import DnspPerformanceAnalytics from './pages/DnspPerformanceAnalytics'
import ReliabilityStandardAnalytics from './pages/ReliabilityStandardAnalytics'
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
import CoalRetirement from './pages/CoalRetirement'
import GasGenEconomics from './pages/GasGenEconomics'
import ConsumerProtection from './pages/ConsumerProtection'
import GeneratorAvailability from './pages/GeneratorAvailability'
import ClimateRiskAnalytics from './pages/ClimateRiskAnalytics'
import SmartGridAnalytics from './pages/SmartGridAnalytics'
import MinimumDemandAnalytics from './pages/MinimumDemandAnalytics'
import MarketEventsAnalysis from './pages/MarketEventsAnalysis'
import BatteryTechAnalytics from './pages/BatteryTechAnalytics'
import CommunityEnergy from './pages/CommunityEnergy'
import AssetManagement from './pages/AssetManagement'
import DecarbonizationPathway from './pages/DecarbonizationPathway'
import NuclearLongDuration from './pages/NuclearLongDuration'
import NuclearEnergyAnalytics from './pages/NuclearEnergyAnalytics'
import BiddingBehaviour from './pages/BiddingBehaviour'
import EnergyPoverty from './pages/EnergyPoverty'
import SpotForecastDashboard from './pages/SpotForecastDashboard'
import HydrogenEconomy from './pages/HydrogenEconomy'
import CarbonCreditMarket from './pages/CarbonCreditMarket'
import GridResilience from './pages/GridResilience'
import EvFleetCharging from './pages/EvFleetCharging'
import RecMarket from './pages/RecMarket'
import TransmissionCongestion from './pages/TransmissionCongestion'
import DermsOrchestration from './pages/DermsOrchestration'
import MarketDesignReform from './pages/MarketDesignReform'
import RezCapacityTracking from './pages/RezCapacityTracking'
import RetailOfferComparison from './pages/RetailOfferComparison'
import SystemOperatorActions from './pages/SystemOperatorActions'
import OffshoreWindPipeline from './pages/OffshoreWindPipeline'
import NetworkTariffReform from './pages/NetworkTariffReform'
import PriceSpikeAnalysis from './pages/PriceSpikeAnalysis'
import StorageRevenueStack from './pages/StorageRevenueStack'
import SolarResourceAnalytics from './pages/SolarResourceAnalytics'
import FuturesMarketRisk from './pages/FuturesMarketRisk'
import WindResourceAnalytics from './pages/WindResourceAnalytics'
import CorporatePpaMarket from './pages/CorporatePpaMarket'
import MicrogridRaps from './pages/MicrogridRaps'
import MarketLiquidity from './pages/MarketLiquidity'
import ThermalEfficiency from './pages/ThermalEfficiency'
import IndustrialDemandFlex from './pages/IndustrialDemandFlex'
import StorageLca from './pages/StorageLca'
import InterconnectorFlowAnalytics from './pages/InterconnectorFlowAnalytics'
import IspProgressTracker from './pages/IspProgressTracker'
import FirmingTechnologyEconomics from './pages/FirmingTechnologyEconomics'
import DemandForecastingModels from './pages/DemandForecastingModels'
import MarketStressTesting from './pages/MarketStressTesting'
import CapacityInvestmentSignals from './pages/CapacityInvestmentSignals'
import FrequencyControlAnalytics from './pages/FrequencyControlAnalytics'
import RecCertificateTracking from './pages/RecCertificateTracking'
import RenewableIntegrationCost from './pages/RenewableIntegrationCost'
import SpotMarketDepthAnalytics from './pages/SpotMarketDepthAnalytics'
import StorageTechRoadmap from './pages/StorageTechRoadmap'
import PlannedOutageAnalytics from './pages/PlannedOutageAnalytics'
import MarketShareTracker from './pages/MarketShareTracker'
import VolatilityRegimeAnalytics from './pages/VolatilityRegimeAnalytics'
import BlackStartCapability from './pages/BlackStartCapability'
import AncillaryServicesCost from './pages/AncillaryServicesCost'
import CbamTradeAnalytics from './pages/CbamTradeAnalytics'
import CongestionRevenueAnalytics from './pages/CongestionRevenueAnalytics'
import ClimatePhysicalRisk from './pages/ClimatePhysicalRisk'
import EnergyAffordabilityAnalytics from './pages/EnergyAffordabilityAnalytics'
import ElectrificationAnalytics from './pages/ElectrificationAnalytics'
import ElectricityExportInfra from './pages/ElectricityExportInfra'
import ElectricityExportEconomicsAnalytics from './pages/ElectricityExportEconomicsAnalytics'
import LdesEconomicsAnalytics from './pages/LdesEconomicsAnalytics'
import GasTransitionAnalytics from './pages/GasTransitionAnalytics'
import ProsumerAnalytics from './pages/ProsumerAnalytics'
import StorageOptimisationAnalytics from './pages/StorageOptimisationAnalytics'
import SettlementAnalytics from './pages/SettlementAnalytics'
import RealtimeOperationsDashboard from './pages/RealtimeOperationsDashboard'
import RenewableAuctionAnalytics from './pages/RenewableAuctionAnalytics'
import VollAnalytics from './pages/VollAnalytics'
import DemandFlexibilityAnalytics from './pages/DemandFlexibilityAnalytics'
import FuturesPriceDiscovery from './pages/FuturesPriceDiscovery'
import ElectricityPriceIndex from './pages/ElectricityPriceIndex'
import InterconnectorUpgradeAnalytics from './pages/InterconnectorUpgradeAnalytics'
import MlfAnalytics from './pages/MlfAnalytics'
import CspAnalytics from './pages/CspAnalytics'
import CarbonIntensityAnalytics from './pages/CarbonIntensityAnalytics'
import NetworkTariffReformAnalytics from './pages/NetworkTariffReformAnalytics'
import TariffCrossSubsidyAnalytics from './pages/TariffCrossSubsidyAnalytics'
import AiDigitalTwinAnalytics from './pages/AiDigitalTwinAnalytics'
import EsooAdequacyAnalytics from './pages/EsooAdequacyAnalytics'
import SocialLicenceAnalytics from './pages/SocialLicenceAnalytics'
import ElectricityOptionsAnalytics from './pages/ElectricityOptionsAnalytics'
import GridFormingInverterAnalytics from './pages/GridFormingInverterAnalytics'
import CapacityMechanismAnalytics from './pages/CapacityMechanismAnalytics'
import DemandForecastAccuracyAnalytics from './pages/DemandForecastAccuracyAnalytics'
import TransmissionInvestmentAnalytics from './pages/TransmissionInvestmentAnalytics'
import RezProgressAnalytics from './pages/RezProgressAnalytics'
import StorageRevenueAnalytics from './pages/StorageRevenueAnalytics'
import CarbonPricePathwayAnalytics from './pages/CarbonPricePathwayAnalytics'
import SpotPriceForecastAnalytics from './pages/SpotPriceForecastAnalytics'
import AncillaryCostAllocationAnalytics from './pages/AncillaryCostAllocationAnalytics'
import MarketLiquidityAnalytics from './pages/MarketLiquidityAnalytics'
import GeneratorRetirementAnalytics from './pages/GeneratorRetirementAnalytics'
import ConsumerHardshipAnalytics from './pages/ConsumerHardshipAnalytics'
import DsrAggregatorAnalytics from './pages/DsrAggregatorAnalytics'
import PowerSystemEventsAnalytics from './pages/PowerSystemEventsAnalytics'
import MerchantRenewableAnalytics from './pages/MerchantRenewableAnalytics'
import RetailerCompetitionAnalytics from './pages/RetailerCompetitionAnalytics'
import StorageCostCurvesAnalytics from './pages/StorageCostCurvesAnalytics'
import ExtremeWeatherResilienceAnalytics from './pages/ExtremeWeatherResilienceAnalytics'
import SpotPriceVolatilityRegimeAnalytics from './pages/SpotPriceVolatilityRegimeAnalytics'
import IndustrialElectrificationAnalytics from './pages/IndustrialElectrificationAnalytics'
import OffshoreWindDevAnalytics from './pages/OffshoreWindDevAnalytics'
import PumpedHydroResourceAssessmentAnalytics from './pages/PumpedHydroResourceAssessmentAnalytics'
import FrequencyControlPerformanceAnalytics from './pages/FrequencyControlPerformanceAnalytics'
import CostReflectiveTariffReformAnalytics from './pages/CostReflectiveTariffReformAnalytics'
import NEMMarketMicrostructureAnalytics from './pages/NEMMarketMicrostructureAnalytics'
import EVFleetGridImpactAnalytics from './pages/EVFleetGridImpactAnalytics'
import HydrogenEconomyAnalytics from './pages/HydrogenEconomyAnalytics'
import RooftopSolarGridAnalytics from './pages/RooftopSolarGridAnalytics'
import RECMarketAnalytics from './pages/RECMarketAnalytics'
import EnergyPovertyAnalytics from './pages/EnergyPovertyAnalytics'
import HedgeEffectivenessAnalytics from './pages/HedgeEffectivenessAnalytics'
import CBAMTradeExposureAnalytics from './pages/CBAMTradeExposureAnalytics'
import DemandResponseProgramAnalytics from './pages/DemandResponseProgramAnalytics'
import InterconnectorCongestionAnalytics from './pages/InterconnectorCongestionAnalytics'
import PPAMarketAnalytics from './pages/PPAMarketAnalytics'
import PPAStructuringAnalytics from './pages/PPAStructuringAnalytics'
import BatteryDispatchStrategyAnalytics from './pages/BatteryDispatchStrategyAnalytics'
import GenerationMixTransitionAnalytics from './pages/GenerationMixTransitionAnalytics'
import StorageDurationEconomicsAnalytics from './pages/StorageDurationEconomicsAnalytics'
import AncillaryServicesMarketDepthAnalytics from './pages/AncillaryServicesMarketDepthAnalytics'
import SRAAnalyticsPage from './pages/SRAAnalyticsPage'
import SpotMarketStressAnalytics from './pages/SpotMarketStressAnalytics'
import ElectricityWorkforceAnalytics from './pages/ElectricityWorkforceAnalytics'
import REZTransmissionAnalytics from './pages/REZTransmissionAnalytics'
import NetworkRegulatoryFrameworkAnalytics from './pages/NetworkRegulatoryFrameworkAnalytics'
import NetworkInvestmentPipelineAnalytics from './pages/NetworkInvestmentPipelineAnalytics'
import NEMDemandForecastAnalytics from './pages/NEMDemandForecastAnalytics'
import HydrogenFuelCellVehicleAnalytics from './pages/HydrogenFuelCellVehicleAnalytics'
import PriceModelComparisonAnalytics from './pages/PriceModelComparisonAnalytics'
import GasElectricityNexusAnalytics from './pages/GasElectricityNexusAnalytics'
import BiddingComplianceAnalytics from './pages/BiddingComplianceAnalytics'
import CommunityEnergyAnalytics from './pages/CommunityEnergyAnalytics'
import GridCybersecurityAnalytics from './pages/GridCybersecurityAnalytics'
import MarketParticipantFinancialAnalytics from './pages/MarketParticipantFinancialAnalytics'
import DigitalTransformationAnalytics from './pages/DigitalTransformationAnalytics'
import NegativePriceEventAnalytics from './pages/NegativePriceEventAnalytics'
import CEROrchestrationAnalytics from './pages/CEROrchestrationAnalytics'
import EnergyTransitionFinanceAnalytics from './pages/EnergyTransitionFinanceAnalytics'
import SystemLoadBalancingAnalytics from './pages/SystemLoadBalancingAnalytics'
import CarbonAccountingAnalytics from './pages/CarbonAccountingAnalytics'
import WholesaleBiddingStrategyAnalytics from './pages/WholesaleBiddingStrategyAnalytics'
import EmergencyManagementAnalytics from './pages/EmergencyManagementAnalytics'
import LDESAnalytics from './pages/LDESAnalytics'
import ConsumerSwitchingRetailChurnAnalytics from './pages/ConsumerSwitchingRetailChurnAnalytics'
import SolarThermalCSPAnalytics from './pages/SolarThermalCSPAnalytics'
import NEMPostReformMarketDesignAnalytics from './pages/NEMPostReformMarketDesignAnalytics'
import ElectricityPriceForecastingModelAnalytics from './pages/ElectricityPriceForecastingModelAnalytics'
import LargeIndustrialDemandAnalytics from './pages/LargeIndustrialDemandAnalytics'
import SpotPriceSpikePredictionAnalytics from './pages/SpotPriceSpikePredictionAnalytics'
import GridEdgeTechnologyAnalytics from './pages/GridEdgeTechnologyAnalytics'
import EnergyStorageDegradationAnalytics from './pages/EnergyStorageDegradationAnalytics'
import CleanHydrogenProductionCostAnalytics from './pages/CleanHydrogenProductionCostAnalytics'
import AncillaryServicesProcurementAnalytics from './pages/AncillaryServicesProcurementAnalytics'
import REZConnectionQueueAnalytics from './pages/REZConnectionQueueAnalytics'
import AustralianCarbonPolicyAnalytics from './pages/AustralianCarbonPolicyAnalytics'
import MarketDesignSimulationAnalytics from './pages/MarketDesignSimulationAnalytics'
import PowerSystemStabilityAnalytics from './pages/PowerSystemStabilityAnalytics'
import EnergyRetailCompetitionAnalytics from './pages/EnergyRetailCompetitionAnalytics'
import CleanEnergyFinanceAnalytics from './pages/CleanEnergyFinanceAnalytics'
import NuclearEnergyEconomicsAnalytics from './pages/NuclearEnergyEconomicsAnalytics'
import BehindMeterCommercialAnalytics from './pages/BehindMeterCommercialAnalytics'
import CapacityInvestmentSchemeAnalytics from './pages/CapacityInvestmentSchemeAnalytics'
import DemandFlexibilityMarketAnalytics from './pages/DemandFlexibilityMarketAnalytics'
import EnergyAssetLifeExtensionAnalytics from './pages/EnergyAssetLifeExtensionAnalytics'
import GreenAmmoniaExportAnalytics from './pages/GreenAmmoniaExportAnalytics'
import ElectricityExportCableAnalytics from './pages/ElectricityExportCableAnalytics'
import IndustrialDecarbonisationAnalytics from './pages/IndustrialDecarbonisationAnalytics'
import CommunityEnergyStorageAnalytics from './pages/CommunityEnergyStorageAnalytics'
import NEMGenerationMixAnalytics from './pages/NEMGenerationMixAnalytics'
import ConsumerEnergyAffordabilityAnalytics from './pages/ConsumerEnergyAffordabilityAnalytics'
import ElectricityPriceRiskAnalytics from './pages/ElectricityPriceRiskAnalytics'
import EVFleetDepotAnalytics from './pages/EVFleetDepotAnalytics'
import WindFarmWakeAnalytics from './pages/WindFarmWakeAnalytics'
import MarketBiddingStrategyAnalytics from './pages/MarketBiddingStrategyAnalytics'
import SolarPVSoilingAnalytics from './pages/SolarPVSoilingAnalytics'
import OTICSCyberSecurityAnalytics from './pages/OTICSCyberSecurityAnalytics'
import STPASAAdequacyAnalytics from './pages/STPASAAdequacyAnalytics'
import GeneratorPerformanceStandardsAnalytics from './pages/GeneratorPerformanceStandardsAnalytics'
import BiomassBioenergyAnalytics from './pages/BiomassBioenergyAnalytics'
import ElectricityFrequencyPerformanceAnalytics from './pages/ElectricityFrequencyPerformanceAnalytics'
import LGCMarketAnalytics from './pages/LGCMarketAnalytics'
import WaveTidalOceanAnalytics from './pages/WaveTidalOceanAnalytics'
import ReactivePowerVoltageAnalytics from './pages/ReactivePowerVoltageAnalytics'
import BatteryRevenueStackAnalytics from './pages/BatteryRevenueStackAnalytics'
import DigitalEnergyTwinAnalytics from './pages/DigitalEnergyTwinAnalytics'
import NetworkProtectionSystemAnalytics from './pages/NetworkProtectionSystemAnalytics'
import PumpedHydroDispatchAnalytics from './pages/PumpedHydroDispatchAnalytics'
import RetailMarketDesignAnalytics from './pages/RetailMarketDesignAnalytics'
import SpotMarketDepthXAnalytics from './pages/SpotMarketDepthXAnalytics'
import SolarFarmOperationsAnalytics from './pages/SolarFarmOperationsAnalytics'
import DistributionNetworkPlanningAnalytics from './pages/DistributionNetworkPlanningAnalytics'
import GridFlexibilityServicesAnalytics from './pages/GridFlexibilityServicesAnalytics'
import HydrogenRefuellingStationAnalytics from './pages/HydrogenRefuellingStationAnalytics'
import OffshoreWindFinanceAnalytics from './pages/OffshoreWindFinanceAnalytics'
import CarbonOffsetProjectAnalytics from './pages/CarbonOffsetProjectAnalytics'
import PowerGridClimateResilienceAnalytics from './pages/PowerGridClimateResilienceAnalytics'
import EnergyStorageTechComparisonAnalytics from './pages/EnergyStorageTechComparisonAnalytics'
import PowerToXEconomicsAnalytics from './pages/PowerToXEconomicsAnalytics'
import ElectricityMarketMicrostructureAnalytics from './pages/ElectricityMarketMicrostructureAnalytics'
import GridDecarbonisationPathwayAnalytics from './pages/GridDecarbonisationPathwayAnalytics'
import RooftopSolarNetworkImpactAnalytics from './pages/RooftopSolarNetworkImpactAnalytics'
import ElectricityNetworkTariffReformAnalytics from './pages/ElectricityNetworkTariffReformAnalytics'
import LongDurationEnergyStorageAnalytics from './pages/LongDurationEnergyStorageAnalytics'
import HydrogenPipelineInfrastructureAnalytics from './pages/HydrogenPipelineInfrastructureAnalytics'
import CarbonCaptureStorageProjectAnalytics from './pages/CarbonCaptureStorageProjectAnalytics'
import EnergyPovertyVulnerableConsumerAnalytics from './pages/EnergyPovertyVulnerableConsumerAnalytics'
import NuclearSmallModularReactorAnalytics from './pages/NuclearSmallModularReactorAnalytics'
import ElectricityMarketTransparencyAnalytics from './pages/ElectricityMarketTransparencyAnalytics'
import GeothermalEnergyDevelopmentAnalytics from './pages/GeothermalEnergyDevelopmentAnalytics'
import SolarThermalPowerPlantAnalytics from './pages/SolarThermalPowerPlantAnalytics'
import EnergyTradingAlgorithmicStrategyAnalytics from './pages/EnergyTradingAlgorithmicStrategyAnalytics'
import EVGridIntegrationV2GAnalytics from './pages/EVGridIntegrationV2GAnalytics'
import BiomethaneGasGridInjectionAnalytics from './pages/BiomethaneGasGridInjectionAnalytics'
import ElectricityMarketForecastingAccuracyAnalytics from './pages/ElectricityMarketForecastingAccuracyAnalytics'
import NationalEnergyTransitionInvestmentAnalytics from './pages/NationalEnergyTransitionInvestmentAnalytics'
import ElectricitySpotPriceSeasonalityAnalytics from './pages/ElectricitySpotPriceSeasonalityAnalytics'
import GridCongestionConstraintAnalytics from './pages/GridCongestionConstraintAnalytics'
import RenewableEnergyZoneDevelopmentAnalytics from './pages/RenewableEnergyZoneDevelopmentAnalytics'
import BatteryStorageDegradationLifetimeAnalytics from './pages/BatteryStorageDegradationLifetimeAnalytics'
import ElectricityConsumerSwitchingChurnAnalytics from './pages/ElectricityConsumerSwitchingChurnAnalytics'
import NEMInertiaSynchronousCondenserAnalytics from './pages/NEMInertiaSynchronousCondenserAnalytics'
import OffshoreWindLeasingSiteAnalytics from './pages/OffshoreWindLeasingSiteAnalytics'
import ElectricityMarketRegulatoryAppealsAnalytics from './pages/ElectricityMarketRegulatoryAppealsAnalytics'
import DistributedEnergyResourceManagementAnalytics from './pages/DistributedEnergyResourceManagementAnalytics'
import MarketPriceFormationReviewAnalytics from './pages/MarketPriceFormationReviewAnalytics'
import ResidentialSolarSelfConsumptionAnalytics from './pages/ResidentialSolarSelfConsumptionAnalytics'
import EnergyInfrastructureCyberThreatAnalytics from './pages/EnergyInfrastructureCyberThreatAnalytics'
import WholesaleGasMarketAnalytics from './pages/WholesaleGasMarketAnalytics'
import ElectricityDemandForecastingMLAnalytics from './pages/ElectricityDemandForecastingMLAnalytics'
import { useDarkMode } from './hooks/useDarkMode'

const NAV_ITEMS = [
  { to: '/',             label: 'Home',         Icon: LayoutDashboard },
  { to: '/live',         label: 'Live Market',  Icon: Zap             },
  { to: '/realtime-operations', label: 'Live Ops Dashboard', Icon: Radio },
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
  { to: '/biomass-bioenergy', label: 'Biomass & Bioenergy', Icon: Leaf       },
  { to: '/merit-order',     label: 'Merit Order',      Icon: TrendingUp      },
  { to: '/ml-dashboard',   label: 'ML Models',        Icon: Brain           },
  { to: '/data-catalog',  label: 'Data Catalog',     Icon: Database        },
  { to: '/scenario',        label: 'Scenario Analysis', Icon: Activity       },
  { to: '/load-duration',  label: 'Load Statistics',  Icon: BarChart2      },
  { to: '/trends',         label: 'Historical Trends', Icon: Clock          },
  { to: '/frequency',      label: 'Frequency',         Icon: Radio          },
  { to: '/futures',        label: 'Energy Futures',    Icon: TrendingUp     },
  { to: '/registry',           label: 'Participants',        Icon: Building2      },
  { to: '/market-share-tracker', label: 'Market Share',      Icon: Users          },
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
  { to: '/offshore-wind',          label: 'Offshore Wind',     Icon: Wind           },
  { to: '/offshore-wind-pipeline', label: 'Offshore Wind Pipeline', Icon: Waves       },
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
  { to: '/coal-retirement', label: 'Coal Retirement',  Icon: Flame          },
  { to: '/gas-gen',         label: 'Gas Economics',    Icon: Activity       },
  { to: '/consumer-protection', label: 'Consumer Protection', Icon: Shield   },
  { to: '/efor',            label: 'Generator EFOR',   Icon: Activity       },
  { to: '/climate-risk',    label: 'Climate Risk',     Icon: CloudLightning },
  { to: '/smart-grid',      label: 'Smart Grid',       Icon: Cpu            },
  { to: '/minimum-demand',  label: 'Min Demand',       Icon: TrendingDown   },
  { to: '/market-events',  label: 'Market Events',    Icon: AlertTriangle  },
  { to: '/battery-tech',   label: 'Battery Tech',     Icon: Battery        },
  { to: '/community-energy', label: 'Community Energy', Icon: Users         },
  { to: '/asset-management', label: 'Asset Management', Icon: Wrench        },
  { to: '/decarbonization', label: 'Net Zero Pathway', Icon: Leaf           },
  { to: '/nuclear-ldes',      label: 'Nuclear & LDES',     Icon: Atom           },
  { to: '/nuclear-energy',    label: 'Nuclear Energy',     Icon: Atom           },
  { to: '/nuclear-energy-economics', label: 'Nuclear Economics', Icon: Atom },
  { to: '/bidding-behaviour', label: 'Bidding Behaviour',  Icon: BarChart2      },
  { to: '/energy-poverty',    label: 'Energy Poverty',     Icon: Heart          },
  { to: '/spot-forecast',     label: 'Spot Forecast',      Icon: Zap            },
  { to: '/hydrogen-economy',  label: 'Hydrogen Economy',   Icon: Fuel           },
  { to: '/hydrogen-economy-analytics', label: 'H2 Economy Analytics', Icon: Atom },
  { to: '/carbon-credit',     label: 'Carbon Credits',     Icon: TreePine       },
  { to: '/grid-resilience',   label: 'Grid Resilience',    Icon: ShieldAlert    },
  { to: '/ev-fleet',          label: 'EV Fleet & V2G',     Icon: Car            },
  { to: '/rec-market',            label: 'REC Market (LGC/STC)',   Icon: Award        },
  { to: '/transmission-congestion', label: 'Transmission Congestion', Icon: Network    },
  { to: '/derms-orchestration', label: 'DERMS & VPP',          Icon: Layers         },
  { to: '/market-design',     label: 'Market Design',      Icon: BookOpen       },
  { to: '/rez-capacity',      label: 'REZ Capacity',       Icon: MapPin         },
  { to: '/retail-offer-comparison', label: 'Retail Offer Compare', Icon: Tag    },
  { to: '/system-operator',   label: 'System Operator',    Icon: AlertOctagon   },
  { to: '/network-tariff-reform', label: 'Network Tariff Reform', Icon: CircuitBoard },
  { to: '/spike-analysis',    label: 'Price Spike Analysis', Icon: Flame          },
  { to: '/storage-revenue-stack', label: 'Storage Revenue Stack', Icon: BarChart3  },
  { to: '/solar-resource',    label: 'Solar Resource',     Icon: SunMedium      },
  { to: '/futures-market-risk', label: 'Futures Market Risk', Icon: Activity     },
  { to: '/wind-resource',         label: 'Wind Resource',      Icon: Tornado        },
  { to: '/corporate-ppa-market', label: 'Corporate PPA Market', Icon: FileText  },
  { to: '/microgrid-raps',    label: 'Microgrids & RAPS',  Icon: Wifi           },
  { to: '/market-liquidity',  label: 'Market Liquidity',   Icon: BarChart       },
  { to: '/thermal-efficiency', label: 'Thermal Efficiency', Icon: Thermometer   },
  { to: '/industrial-demand-flex', label: 'Industrial Demand Flex', Icon: Factory },
  { to: '/storage-lca',       label: 'Storage LCA',        Icon: RefreshCw      },
  { to: '/interconnector-flow-analytics', label: 'Interconnector Flows', Icon: ArrowLeftRight },
  { to: '/isp-progress',                 label: 'ISP Progress',              Icon: Map            },
  { to: '/firming-technology-economics', label: 'Firming Tech Economics',     Icon: Flame          },
  { to: '/demand-forecasting-models',   label: 'Demand Forecast Models',     Icon: Brain          },
  { to: '/market-stress-testing',       label: 'Market Stress Testing',      Icon: ShieldAlert    },
  { to: '/capacity-investment-signals', label: 'Capacity Investment Signals', Icon: TrendingUp     },
  { to: '/frequency-control-analytics', label: 'Frequency Control',          Icon: Activity       },
  { to: '/rec-certificate-tracking',   label: 'REC Certificate Tracking',    Icon: Award          },
  { to: '/spot-market-depth',          label: 'Spot Market Depth',            Icon: Layers         },
  { to: '/storage-tech-roadmap',       label: 'Storage Tech Roadmap',         Icon: GitBranch      },
  { to: '/renewable-integration-cost', label: 'Renewable Integration Cost',   Icon: GitMerge       },
  { to: '/planned-outage-analytics',  label: 'Planned Outage & Maintenance', Icon: Calendar       },
  { to: '/volatility-regime-analytics', label: 'Volatility Regime Analytics', Icon: TrendingUp    },
  { to: '/black-start-capability',      label: 'Black Start Capability',       Icon: ShieldAlert   },
  { to: '/ancillary-services-cost',     label: 'Ancillary Services Cost',      Icon: Gauge          },
  { to: '/cbam-trade-analytics',       label: 'CBAM Trade Analytics',         Icon: Globe          },
  { to: '/congestion-revenue-analytics', label: 'Congestion Revenue & SRA',  Icon: Network        },
  { to: '/climate-physical-risk',       label: 'Climate Physical Risk',      Icon: Thermometer    },
  { to: '/energy-affordability',        label: 'Energy Affordability',         Icon: DollarSign     },
  { to: '/electrification-analytics',  label: 'Building Electrification',     Icon: Flame          },
  { to: '/electricity-export-infra',   label: 'Electricity Export Infra',     Icon: Globe2         },
  { to: '/electricity-export-economics', label: 'Electricity Export Economics', Icon: Globe          },
  { to: '/ldes-economics',             label: 'LDES Economics',               Icon: Database       },
  { to: '/prosumer-analytics',         label: 'Prosumer & BTM Analytics',     Icon: Sun            },
  { to: '/gas-transition-analytics',  label: 'Gas Transition Analytics',     Icon: Fuel           },
  { to: '/tnsp-analytics',                  label: 'TNSP Revenue & Investment',    Icon: Building2      },
  { to: '/dnsp-analytics',                 label: 'DNSP Performance & Investment', Icon: Network        },
  { to: '/reliability-standard-analytics', label: 'NEM Reliability Standard',     Icon: ShieldCheck    },
  { to: '/storage-optimisation-analytics', label: 'Storage Revenue Optimisation', Icon: Battery },
  { to: '/settlement-analytics',           label: '5-Min Settlement & Prudential', Icon: CreditCard },
  { to: '/renewable-auction',             label: 'Renewable Auction Design & CfD Analytics', Icon: Award },
  { to: '/voll-analytics',               label: 'VoLL Outage Cost Analytics',   Icon: AlertTriangle },
  { to: '/demand-flexibility-analytics', label: 'Demand Flexibility & ILM',     Icon: Gauge      },
  { to: '/futures-price-discovery',      label: 'Futures Price Discovery',       Icon: TrendingUp },
  { to: '/electricity-price-index',     label: 'Electricity CPI & Retail',      Icon: ShoppingCart },
  { to: '/interconnector-upgrade-analytics', label: 'Interconnector Upgrade Business Case', Icon: ArrowLeftRight },
  { to: '/mlf-analytics',                   label: 'MLF Deep Dive Analytics',              Icon: TrendingDown   },
  { to: '/csp-analytics',                    label: 'CSP & Solar Thermal Analytics',         Icon: Sun            },
  { to: '/carbon-intensity-analytics',       label: 'Carbon Intensity Analytics',            Icon: Leaf           },
  { to: '/network-tariff-reform-analytics',  label: 'Tariff Reform & DER Incentives',         Icon: Sliders        },
  { to: '/tariff-cross-subsidy',             label: 'Cross-Subsidy & Cost-Reflective Tariffs', Icon: BarChart2      },
  { to: '/ai-digital-twin-analytics',        label: 'AI & Digital Twin Analytics',             Icon: Cpu            },
  { to: '/esoo-adequacy-analytics',          label: 'ESOO Generation Adequacy',                Icon: Activity       },
  { to: '/social-licence-analytics',        label: 'Social Licence & Equity Analytics',        Icon: Users          },
  { to: '/electricity-options',             label: 'Options Analytics',                         Icon: TrendingUp     },
  { to: '/grid-forming-inverter',           label: 'Grid-Forming Inverter & System Strength',    Icon: Zap            },
  { to: '/capacity-mechanism',              label: 'Capacity Mechanism',                          Icon: Shield         },
  { to: '/demand-forecast-accuracy', label: 'Forecast Accuracy', Icon: BarChart2 },
  { to: '/transmission-investment', label: 'Transmission Investment', Icon: Network },
  { to: '/rez-progress',      label: 'REZ Progress',       Icon: MapPin         },
  { to: '/storage-revenue',   label: 'Storage Revenue Analytics', Icon: BatteryCharging },
  { to: '/carbon-price-pathway', label: 'Carbon Price Pathway',    Icon: Leaf           },
  { to: '/spot-price-forecast', label: 'Spot Price Forecast Analytics', Icon: Brain },
  { to: '/ancillary-cost-allocation', label: 'Ancillary Cost Allocation', Icon: DollarSign },
  { to: '/wholesale-liquidity', label: 'Wholesale Market Liquidity', Icon: BarChart3 },
  { to: '/generator-retirement', label: 'Generator Retirement',   Icon: Power          },
  { to: '/consumer-hardship',    label: 'Consumer Hardship',       Icon: Heart          },
  { to: '/dsr-aggregator',       label: 'DSR Aggregator Analytics', Icon: Sliders        },
  { to: '/power-system-events',  label: 'Power System Security Events', Icon: AlertTriangle },
  { to: '/merchant-renewable',   label: 'Merchant Wind & Solar',        Icon: Wind           },
  { to: '/retailer-competition', label: 'Retailer Competition',          Icon: Users          },
  { to: '/storage-cost-curves', label: 'Storage Cost Curves',            Icon: TrendingDown   },
  { to: '/extreme-weather-resilience', label: 'Extreme Weather Resilience', Icon: Tornado        },
  { to: '/spot-price-volatility-regime', label: 'Spot Price Volatility Regime', Icon: Activity  },
  { to: '/industrial-electrification', label: 'Industrial Electrification',   Icon: Zap        },
  { to: '/offshore-wind-dev-analytics', label: 'Offshore Wind Dev Pipeline',  Icon: Wind       },
  { to: '/offshore-wind-finance',       label: 'Offshore Wind Finance',        Icon: Wind       },
  { to: '/carbon-offset-project',      label: 'Carbon Offset Projects',       Icon: Leaf       },
  { to: '/pumped-hydro-resource-assessment', label: 'Pumped Hydro Resource Assessment', Icon: Droplets },
  { to: '/frequency-control-performance', label: 'NEM Frequency Control Performance', Icon: Radio  },
  { to: '/cost-reflective-tariff-reform', label: 'Cost-Reflective Tariff Reform', Icon: BarChart2 },
  { to: '/ev-fleet-grid-impact',          label: 'EV Fleet Grid Impact',          Icon: Car          },
  { to: '/nem-market-microstructure',     label: 'NEM Market Microstructure',     Icon: TrendingUp   },
  { to: '/rooftop-solar-grid',           label: 'Rooftop Solar Grid Analytics',  Icon: Sun          },
  { to: '/rec-market-analytics',         label: 'REC Analytics (LGC & STC)',     Icon: Award        },
  { to: '/energy-poverty-analytics',    label: 'Energy Poverty Analytics',      Icon: Heart        },
  { to: '/hedge-effectiveness',         label: 'Hedge Effectiveness',           Icon: Shield        },
  { to: '/cbam-trade-exposure',         label: 'CBAM Trade Exposure',           Icon: Globe          },
  { to: '/demand-response-programs',   label: 'Demand Response Programs',     Icon: Sliders        },
  { to: '/interconnector-congestion',  label: 'Interconnector Congestion',    Icon: GitMerge       },
  { to: '/ppa-market',                label: 'PPA Market Analytics',         Icon: FileText       },
  { to: '/ppa-structuring',           label: 'PPA Structuring',              Icon: FileText       },
  { to: '/battery-dispatch-strategy', label: 'Battery Dispatch Strategy',    Icon: Battery        },
  { to: '/generation-mix-transition', label: 'Generation Mix Transition',    Icon: BarChart       },
  { to: '/storage-duration-economics', label: 'Storage Duration Economics',  Icon: Clock          },
  { to: '/ancillary-market-depth',    label: 'FCAS Market Depth Analytics', Icon: Layers         },
  { to: '/sra-analytics',            label: 'SRA Settlement Analytics',    Icon: DollarSign     },
  { to: '/spot-market-stress',       label: 'NEM Spot Market Stress Testing', Icon: AlertTriangle  },
  { to: '/electricity-workforce',   label: 'Electricity Workforce & Skills', Icon: Users          },
  { to: '/rez-transmission',        label: 'REZ Transmission Infrastructure', Icon: Network        },
  { to: '/network-regulatory-framework', label: 'Network Regulatory Framework', Icon: Scale         },
  { to: '/price-model-comparison',       label: 'Price Forecasting Model Comparison', Icon: Cpu    },
  { to: '/gas-electricity-nexus',        label: 'Gas-Electricity Nexus Analytics',     Icon: Flame         },
  { to: '/bidding-compliance',           label: 'Generator Bidding Compliance',        Icon: AlertOctagon  },
  { to: '/community-energy-analytics',  label: 'Community Energy & Microgrid',        Icon: Home          },
  { to: '/grid-cybersecurity',          label: 'Grid Cybersecurity & Resilience',     Icon: Lock          },
  { to: '/market-participant-financial', label: 'Market Participant Financial Health', Icon: CreditCard    },
  { to: '/digital-transformation',      label: 'Digital Transformation Analytics',   Icon: Smartphone    },
  { to: '/energy-transition-finance',   label: 'Energy Transition Finance',          Icon: DollarSign    },
  { to: '/negative-price-events',       label: 'NEM Negative Price Events',          Icon: TrendingDown  },
  { to: '/cer-orchestration',           label: 'CER Orchestration Analytics',        Icon: Wifi          },
  { to: '/system-load-balancing',       label: 'System Load Balancing & Reserve Adequacy', Icon: BarChart2 },
  { to: '/carbon-accounting',           label: 'Carbon Accounting & Scope 2 Analytics',    Icon: Leaf       },
  { to: '/wholesale-bidding-strategy',  label: 'NEM Wholesale Bidding Strategy Analytics',  Icon: TrendingUp },
  { to: '/ldes-analytics',             label: 'LDES Technology & Investment Analytics',     Icon: Database   },
  { to: '/emergency-management',        label: 'NEM Emergency Management & Contingency Response', Icon: AlertTriangle },
  { to: '/consumer-switching-retail-churn', label: 'Consumer Switching & Churn', Icon: Users },
  { to: '/solar-thermal-csp', label: 'Solar Thermal CSP', Icon: Sun },
  { to: '/nem-post-reform-market-design', label: 'Post-Reform Market Design', Icon: Scale },
  { to: '/electricity-price-forecasting-models', label: 'Price Forecasting Models', Icon: Activity },
  { to: '/large-industrial-demand', label: 'Large Industrial Demand', Icon: Factory },
  { to: '/network-investment-pipeline', label: 'Network Investment Pipeline', Icon: GitBranch },
  { to: '/nem-demand-forecast', label: 'NEM Demand Forecast', Icon: TrendingUp },
  { to: '/hydrogen-fuel-cell-vehicles', label: 'Hydrogen Fuel Cell Vehicles', Icon: Truck },
  { to: '/spot-price-spike-prediction', label: 'Spike Price Prediction', Icon: AlertOctagon },
  { to: '/grid-edge-technology', label: 'Grid Edge Technology', Icon: Cpu },
  { to: '/bess-degradation', label: 'Storage Degradation', Icon: Battery },
  { to: '/clean-hydrogen-production-cost', label: 'H2 Production Cost', Icon: Flame },
  { to: '/ancillary-services-procurement', label: 'AS Procurement', Icon: Radio },
  { to: '/rez-connection-queue', label: 'REZ Connection Queue', Icon: Grid },
  { to: '/australian-carbon-policy', label: 'Carbon Policy', Icon: Leaf },
  { to: '/market-design-simulation', label: 'Market Design Simulation', Icon: BarChart2 },
  { to: '/power-system-stability', label: 'Power System Stability', Icon: Zap },
  { to: '/energy-retail-competition', label: 'Retail Competition', Icon: ShoppingCart },
  { to: '/clean-energy-finance', label: 'Clean Energy Finance', Icon: DollarSign },
  { to: '/behind-meter-commercial', label: 'BTM Commercial Analytics', Icon: Building2 },
  { to: '/capacity-investment-scheme', label: 'CIS Analytics', Icon: Award },
  { to: '/demand-flexibility-market', label: 'Demand Flexibility Market', Icon: Sliders },
  { to: '/energy-asset-life-extension', label: 'Asset Life Extension', Icon: Wrench },
  { to: '/green-ammonia-export', label: 'Green Ammonia Export', Icon: Ship },
  { to: '/electricity-export-cable', label: 'Electricity Export Cable', Icon: Radio },
  { to: '/industrial-decarbonisation', label: 'Industrial Decarbonisation', Icon: Factory },
  { to: '/community-energy-storage', label: 'Community Energy Storage', Icon: Users },
  { to: '/nem-generation-mix', label: 'NEM Generation Mix', Icon: BarChart2 },
  { to: '/consumer-energy-affordability', label: 'Consumer Energy Affordability', Icon: Heart },
  { to: '/electricity-price-risk', label: 'Electricity Price Risk Mgmt', Icon: Shield },
  { to: '/ev-fleet-depot',    label: 'EV Fleet Depot Charging',    Icon: Truck  },
  { to: '/wind-farm-wake',    label: 'Wind Farm Wake Analytics',   Icon: Wind   },
  { to: '/market-bidding-strategy', label: 'Market Bidding Strategy Analytics', Icon: Target },
  { to: '/solar-pv-soiling',  label: 'Solar PV Soiling & Performance', Icon: Sun },
  { to: '/ot-ics-cyber-security', label: 'OT/ICS Energy Cyber Security', Icon: Lock },
  { to: '/stpasa-adequacy', label: 'STPASA Adequacy', Icon: AlertTriangle },
  { to: '/generator-performance-standards', label: 'Generator GPS Compliance', Icon: CheckCircle },
  { to: '/electricity-frequency-performance', label: 'Electricity Frequency Performance', Icon: Activity },
  { to: '/lgc-market',                        label: 'LGC Market Analytics',               Icon: Award    },
  { to: '/wave-tidal-ocean', label: 'Wave & Tidal Ocean Energy', Icon: Waves },
  { to: '/reactive-power-voltage', label: 'Reactive Power & Voltage', Icon: Zap },
  { to: '/battery-revenue-stack', label: 'Battery Revenue Stack', Icon: Battery },
  { to: '/digital-energy-twin', label: 'Digital Energy Twin', Icon: Monitor },
  { to: '/network-protection-system', label: 'Network Protection System', Icon: ShieldCheck },
  { to: '/pumped-hydro-dispatch', label: 'Pumped Hydro Dispatch', Icon: Droplets },
  { to: '/retail-market-design', label: 'Retail Market Design', Icon: ShoppingBag },
  { to: '/spot-market-depth-x', label: 'Spot Market Depth X', Icon: TrendingUp },
  { to: '/solar-farm-operations', label: 'Solar Farm O&M Analytics', Icon: Sun },
  { to: '/distribution-network-planning', label: 'Distribution Network Planning', Icon: Network },
  { to: '/grid-flexibility-services', label: 'Grid Flexibility Services Analytics', Icon: Moon },
  { to: '/hydrogen-refuelling-station', label: 'Hydrogen Refuelling Station Analytics', Icon: Fuel },
  { to: '/power-grid-climate-resilience', label: 'Power Grid Climate Resilience', Icon: CloudLightning },
  { to: '/energy-storage-tech-comparison', label: 'Storage Tech Comparison', Icon: Battery },
  { to: '/power-to-x-economics', label: 'Power-to-X Economics', Icon: Zap },
  { to: '/electricity-market-microstructure', label: 'Market Microstructure', Icon: BarChart2 },
  { to: '/grid-decarbonisation-pathway', label: 'Grid Decarbonisation', Icon: TrendingDown },
  { to: '/rooftop-solar-network-impact', label: 'Rooftop Solar Impact', Icon: Sun },
  { to: '/electricity-network-tariff-reform', label: 'Network Tariff Reform', Icon: DollarSign },
  { to: '/long-duration-energy-storage', label: 'Long Duration Storage', Icon: Database },
  { to: '/hydrogen-pipeline-infrastructure', label: 'H2 Pipeline Infrastructure', Icon: GitBranch },
  { to: '/carbon-capture-storage-project',  label: 'CCS Project Analytics',       Icon: Layers    },
  { to: '/energy-poverty-vulnerable-consumer', label: 'Energy Poverty',           Icon: Users     },
  { to: '/nuclear-small-modular-reactor',      label: 'SMR Nuclear Analytics',     Icon: Atom      },
  { to: '/electricity-market-transparency',    label: 'Market Transparency',        Icon: Eye       },
  { to: '/geothermal-energy-development',      label: 'Geothermal Development',     Icon: Thermometer },
  { to: '/solar-thermal-power-plant',          label: 'Solar Thermal CSP',          Icon: Sun         },
  { to: '/energy-trading-algorithmic-strategy', label: 'Algo Trading Strategy',     Icon: TrendingUp  },
  { to: '/ev-grid-integration-v2g',            label: 'EV Grid Integration V2G',   Icon: Plug        },
  { to: '/biomethane-gas-grid-injection',      label: 'Biomethane Gas Grid',        Icon: Leaf        },
  { to: '/electricity-market-forecasting-accuracy', label: 'Forecast Accuracy', Icon: Target      },
  { to: '/national-energy-transition-investment',  label: 'Energy Transition Investment', Icon: TrendingUp },
  { to: '/electricity-spot-price-seasonality', label: 'Price Seasonality', Icon: BarChart2 },
  { to: '/grid-congestion-constraint', label: 'Grid Congestion', Icon: GitBranch },
  { to: '/electricity-market-competition-concentration', label: 'Market Competition', Icon: PieChart },
  { to: '/renewable-energy-zone-development', label: 'REZ Development', Icon: Map },
  { to: '/battery-storage-degradation-lifetime', label: 'Battery Degradation', Icon: Battery },
  { to: '/electricity-consumer-switching-churn', label: 'Consumer Switching', Icon: Users },
  { to: '/nem-inertia-synchronous-condenser', label: 'Inertia & Syncondensers', Icon: Activity },
  { to: '/offshore-wind-leasing-site', label: 'Offshore Wind Sites', Icon: Wind },
  { to: '/electricity-market-regulatory-appeals', label: 'Regulatory Appeals', Icon: Scale },
  { to: '/distributed-energy-resource-management', label: 'DER Management', Icon: Sliders },
  { to: '/market-price-formation-review', label: 'Price Formation Review', Icon: AlertCircle },
  { to: '/residential-solar-self-consumption', label: 'Solar Self-Consumption', Icon: HomeIcon },
  { to: '/energy-infrastructure-cyber-threat', label: 'Cyber Threat Analytics', Icon: Shield },
  { to: '/wholesale-gas-market', label: 'Wholesale Gas Market', Icon: Flame },
  { to: '/electricity-demand-forecasting-ml', label: 'Demand Forecast ML', Icon: Brain },
  { to: '/settings',          label: 'Settings',           Icon: SettingsIcon   },
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
              <Route path="/offshore-wind-pipeline" element={<OffshoreWindPipeline />} />
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
              <Route path="/coal-retirement" element={<CoalRetirement />}       />
              <Route path="/gas-gen"         element={<GasGenEconomics />}       />
              <Route path="/consumer-protection" element={<ConsumerProtection />} />
              <Route path="/efor"            element={<GeneratorAvailability />} />
              <Route path="/climate-risk"    element={<ClimateRiskAnalytics />} />
              <Route path="/smart-grid"      element={<SmartGridAnalytics />}   />
              <Route path="/minimum-demand"  element={<MinimumDemandAnalytics />} />
              <Route path="/market-events"  element={<MarketEventsAnalysis />}  />
              <Route path="/battery-tech"   element={<BatteryTechAnalytics />}  />
              <Route path="/community-energy" element={<CommunityEnergy />}     />
              <Route path="/asset-management" element={<AssetManagement />}    />
              <Route path="/decarbonization" element={<DecarbonizationPathway />} />
              <Route path="/nuclear-ldes"      element={<NuclearLongDuration />}    />
              <Route path="/nuclear-energy"   element={<NuclearEnergyAnalytics />} />
              <Route path="/bidding-behaviour" element={<BiddingBehaviour />}    />
              <Route path="/energy-poverty"    element={<EnergyPoverty />}       />
              <Route path="/spot-forecast"     element={<SpotForecastDashboard />} />
              <Route path="/hydrogen-economy"  element={<HydrogenEconomy />}      />
              <Route path="/hydrogen-economy-analytics" element={<HydrogenEconomyAnalytics />} />
              <Route path="/carbon-credit"     element={<CarbonCreditMarket />}  />
              <Route path="/grid-resilience"   element={<GridResilience />}      />
              <Route path="/ev-fleet"          element={<EvFleetCharging />}     />
              <Route path="/rec-market"        element={<RecMarket />}           />
              <Route path="/transmission-congestion" element={<TransmissionCongestion />} />
              <Route path="/derms-orchestration" element={<DermsOrchestration />}   />
              <Route path="/market-design"     element={<MarketDesignReform />}  />
              <Route path="/rez-capacity"      element={<RezCapacityTracking />} />
              <Route path="/retail-offer-comparison" element={<RetailOfferComparison />} />
              <Route path="/system-operator"   element={<SystemOperatorActions />} />
              <Route path="/network-tariff-reform" element={<NetworkTariffReform />} />
              <Route path="/spike-analysis"    element={<PriceSpikeAnalysis />}  />
              <Route path="/storage-revenue-stack" element={<StorageRevenueStack />} />
              <Route path="/solar-resource"    element={<SolarResourceAnalytics />} />
              <Route path="/futures-market-risk" element={<FuturesMarketRisk />}  />
              <Route path="/wind-resource"         element={<WindResourceAnalytics />}  />
              <Route path="/corporate-ppa-market" element={<CorporatePpaMarket />}    />
              <Route path="/microgrid-raps"    element={<MicrogridRaps />}         />
              <Route path="/market-liquidity"  element={<MarketLiquidity />}       />
              <Route path="/thermal-efficiency" element={<ThermalEfficiency />}  />
              <Route path="/industrial-demand-flex" element={<IndustrialDemandFlex />} />
              <Route path="/storage-lca"       element={<StorageLca />}          />
              <Route path="/interconnector-flow-analytics" element={<InterconnectorFlowAnalytics />} />
              <Route path="/isp-progress"                 element={<IspProgressTracker />}           />
              <Route path="/firming-technology-economics" element={<FirmingTechnologyEconomics />}  />
              <Route path="/demand-forecasting-models"   element={<DemandForecastingModels />}     />
              <Route path="/market-stress-testing"       element={<MarketStressTesting />}         />
              <Route path="/capacity-investment-signals" element={<CapacityInvestmentSignals />}   />
              <Route path="/frequency-control-analytics" element={<FrequencyControlAnalytics />}  />
              <Route path="/rec-certificate-tracking"    element={<RecCertificateTracking />}      />
              <Route path="/spot-market-depth"           element={<SpotMarketDepthAnalytics />}    />
              <Route path="/storage-tech-roadmap"        element={<StorageTechRoadmap />}           />
              <Route path="/renewable-integration-cost"  element={<RenewableIntegrationCost />}    />
              <Route path="/planned-outage-analytics"    element={<PlannedOutageAnalytics />}      />
              <Route path="/market-share-tracker"        element={<MarketShareTracker />}          />
              <Route path="/volatility-regime-analytics" element={<VolatilityRegimeAnalytics />}   />
              <Route path="/black-start-capability"      element={<BlackStartCapability />}         />
              <Route path="/ancillary-services-cost"    element={<AncillaryServicesCost />}        />
              <Route path="/cbam-trade-analytics"       element={<CbamTradeAnalytics />}          />
              <Route path="/congestion-revenue-analytics" element={<CongestionRevenueAnalytics />} />
              <Route path="/climate-physical-risk"       element={<ClimatePhysicalRisk />}         />
              <Route path="/energy-affordability"        element={<EnergyAffordabilityAnalytics />} />
              <Route path="/electrification-analytics"   element={<ElectrificationAnalytics />}     />
              <Route path="/electricity-export-infra"    element={<ElectricityExportInfra />}       />
              <Route path="/electricity-export-economics" element={<ElectricityExportEconomicsAnalytics />} />
              <Route path="/ldes-economics"              element={<LdesEconomicsAnalytics />}       />
              <Route path="/gas-transition-analytics"    element={<GasTransitionAnalytics />}       />
              <Route path="/prosumer-analytics"          element={<ProsumerAnalytics />}            />
              <Route path="/tnsp-analytics"                  element={<TnspAnalytics />}                        />
              <Route path="/dnsp-analytics"                element={<DnspPerformanceAnalytics />}             />
              <Route path="/reliability-standard-analytics" element={<ReliabilityStandardAnalytics />} />
              <Route path="/storage-optimisation-analytics" element={<StorageOptimisationAnalytics />} />
              <Route path="/settlement-analytics"          element={<SettlementAnalytics />}          />
              <Route path="/realtime-operations" element={<RealtimeOperationsDashboard />} />
              <Route path="/renewable-auction"           element={<RenewableAuctionAnalytics />} />
              <Route path="/voll-analytics"              element={<VollAnalytics />}                />
              <Route path="/demand-flexibility-analytics" element={<DemandFlexibilityAnalytics />} />
              <Route path="/futures-price-discovery"      element={<FuturesPriceDiscovery />}      />
              <Route path="/electricity-price-index"    element={<ElectricityPriceIndex />}      />
              <Route path="/interconnector-upgrade-analytics" element={<InterconnectorUpgradeAnalytics />} />
              <Route path="/mlf-analytics"               element={<MlfAnalytics />}               />
              <Route path="/csp-analytics"               element={<CspAnalytics />}               />
              <Route path="/carbon-intensity-analytics"  element={<CarbonIntensityAnalytics />}   />
              <Route path="/network-tariff-reform-analytics" element={<NetworkTariffReformAnalytics />} />
              <Route path="/tariff-cross-subsidy"            element={<TariffCrossSubsidyAnalytics />} />
              <Route path="/ai-digital-twin-analytics"   element={<AiDigitalTwinAnalytics />}     />
              <Route path="/esoo-adequacy-analytics"     element={<EsooAdequacyAnalytics />}      />
              <Route path="/social-licence-analytics"    element={<SocialLicenceAnalytics />}     />
              <Route path="/electricity-options"          element={<ElectricityOptionsAnalytics />} />
              <Route path="/grid-forming-inverter"       element={<GridFormingInverterAnalytics />} />
              <Route path="/capacity-mechanism"          element={<CapacityMechanismAnalytics />}  />
              <Route path="/demand-forecast-accuracy" element={<DemandForecastAccuracyAnalytics />} />
              <Route path="/transmission-investment" element={<TransmissionInvestmentAnalytics />} />
              <Route path="/rez-progress"      element={<RezProgressAnalytics />} />
              <Route path="/storage-revenue"   element={<StorageRevenueAnalytics />} />
              <Route path="/carbon-price-pathway" element={<CarbonPricePathwayAnalytics />} />
              <Route path="/spot-price-forecast" element={<SpotPriceForecastAnalytics />} />
              <Route path="/ancillary-cost-allocation" element={<AncillaryCostAllocationAnalytics />} />
              <Route path="/wholesale-liquidity" element={<MarketLiquidityAnalytics />} />
              <Route path="/generator-retirement" element={<GeneratorRetirementAnalytics />} />
              <Route path="/consumer-hardship"   element={<ConsumerHardshipAnalytics />}   />
              <Route path="/dsr-aggregator"      element={<DsrAggregatorAnalytics />}      />
              <Route path="/power-system-events" element={<PowerSystemEventsAnalytics />}  />
              <Route path="/merchant-renewable"  element={<MerchantRenewableAnalytics />}  />
              <Route path="/retailer-competition" element={<RetailerCompetitionAnalytics />} />
              <Route path="/storage-cost-curves" element={<StorageCostCurvesAnalytics />} />
              <Route path="/extreme-weather-resilience" element={<ExtremeWeatherResilienceAnalytics />} />
              <Route path="/spot-price-volatility-regime" element={<SpotPriceVolatilityRegimeAnalytics />} />
              <Route path="/industrial-electrification" element={<IndustrialElectrificationAnalytics />} />
              <Route path="/offshore-wind-dev-analytics" element={<OffshoreWindDevAnalytics />} />
              <Route path="/pumped-hydro-resource-assessment" element={<PumpedHydroResourceAssessmentAnalytics />} />
              <Route path="/frequency-control-performance" element={<FrequencyControlPerformanceAnalytics />} />
              <Route path="/cost-reflective-tariff-reform" element={<CostReflectiveTariffReformAnalytics />} />
              <Route path="/ev-fleet-grid-impact"          element={<EVFleetGridImpactAnalytics />}          />
              <Route path="/nem-market-microstructure"     element={<NEMMarketMicrostructureAnalytics />}     />
              <Route path="/rooftop-solar-grid"            element={<RooftopSolarGridAnalytics />}            />
              <Route path="/rec-market-analytics"          element={<RECMarketAnalytics />}                   />
              <Route path="/energy-poverty-analytics"    element={<EnergyPovertyAnalytics />}              />
              <Route path="/hedge-effectiveness"         element={<HedgeEffectivenessAnalytics />}         />
              <Route path="/cbam-trade-exposure"         element={<CBAMTradeExposureAnalytics />}          />
              <Route path="/demand-response-programs"   element={<DemandResponseProgramAnalytics />}     />
              <Route path="/interconnector-congestion"   element={<InterconnectorCongestionAnalytics />}  />
              <Route path="/ppa-market"                  element={<PPAMarketAnalytics />}                 />
              <Route path="/ppa-structuring"             element={<PPAStructuringAnalytics />}            />
              <Route path="/battery-dispatch-strategy"   element={<BatteryDispatchStrategyAnalytics />}   />
              <Route path="/generation-mix-transition"   element={<GenerationMixTransitionAnalytics />}   />
              <Route path="/storage-duration-economics" element={<StorageDurationEconomicsAnalytics />}  />
              <Route path="/ancillary-market-depth"    element={<AncillaryServicesMarketDepthAnalytics />} />
              <Route path="/sra-analytics"             element={<SRAAnalyticsPage />}                      />
              <Route path="/spot-market-stress"        element={<SpotMarketStressAnalytics />}             />
              <Route path="/electricity-workforce"     element={<ElectricityWorkforceAnalytics />}         />
              <Route path="/rez-transmission"          element={<REZTransmissionAnalytics />}               />
              <Route path="/network-regulatory-framework" element={<NetworkRegulatoryFrameworkAnalytics />} />
              <Route path="/price-model-comparison"       element={<PriceModelComparisonAnalytics />}       />
              <Route path="/gas-electricity-nexus"         element={<GasElectricityNexusAnalytics />}        />
              <Route path="/bidding-compliance"           element={<BiddingComplianceAnalytics />}          />
              <Route path="/community-energy-analytics"  element={<CommunityEnergyAnalytics />}            />
              <Route path="/grid-cybersecurity"           element={<GridCybersecurityAnalytics />}           />
              <Route path="/market-participant-financial" element={<MarketParticipantFinancialAnalytics />}  />
              <Route path="/digital-transformation"       element={<DigitalTransformationAnalytics />}       />
              <Route path="/energy-transition-finance"   element={<EnergyTransitionFinanceAnalytics />}     />
              <Route path="/negative-price-events"        element={<NegativePriceEventAnalytics />}          />
              <Route path="/cer-orchestration"             element={<CEROrchestrationAnalytics />}            />
              <Route path="/system-load-balancing"         element={<SystemLoadBalancingAnalytics />}          />
              <Route path="/carbon-accounting"             element={<CarbonAccountingAnalytics />}             />
              <Route path="/wholesale-bidding-strategy"    element={<WholesaleBiddingStrategyAnalytics />}     />
              <Route path="/ldes-analytics"                element={<LDESAnalytics />}                         />
              <Route path="/emergency-management"          element={<EmergencyManagementAnalytics />}           />
              <Route path="/consumer-switching-retail-churn" element={<ConsumerSwitchingRetailChurnAnalytics />} />
              <Route path="/solar-thermal-csp" element={<SolarThermalCSPAnalytics />} />
              <Route path="/nem-post-reform-market-design" element={<NEMPostReformMarketDesignAnalytics />} />
              <Route path="/electricity-price-forecasting-models" element={<ElectricityPriceForecastingModelAnalytics />} />
              <Route path="/large-industrial-demand" element={<LargeIndustrialDemandAnalytics />} />
              <Route path="/network-investment-pipeline" element={<NetworkInvestmentPipelineAnalytics />} />
              <Route path="/nem-demand-forecast" element={<NEMDemandForecastAnalytics />} />
              <Route path="/hydrogen-fuel-cell-vehicles" element={<HydrogenFuelCellVehicleAnalytics />} />
              <Route path="/spot-price-spike-prediction" element={<SpotPriceSpikePredictionAnalytics />} />
              <Route path="/grid-edge-technology" element={<GridEdgeTechnologyAnalytics />} />
              <Route path="/bess-degradation" element={<EnergyStorageDegradationAnalytics />} />
              <Route path="/clean-hydrogen-production-cost" element={<CleanHydrogenProductionCostAnalytics />} />
              <Route path="/ancillary-services-procurement" element={<AncillaryServicesProcurementAnalytics />} />
              <Route path="/rez-connection-queue" element={<REZConnectionQueueAnalytics />} />
              <Route path="/australian-carbon-policy" element={<AustralianCarbonPolicyAnalytics />} />
              <Route path="/market-design-simulation" element={<MarketDesignSimulationAnalytics />} />
              <Route path="/power-system-stability" element={<PowerSystemStabilityAnalytics />} />
              <Route path="/energy-retail-competition" element={<EnergyRetailCompetitionAnalytics />} />
              <Route path="/clean-energy-finance" element={<CleanEnergyFinanceAnalytics />} />
              <Route path="/nuclear-energy-economics" element={<NuclearEnergyEconomicsAnalytics />} />
              <Route path="/behind-meter-commercial" element={<BehindMeterCommercialAnalytics />} />
              <Route path="/capacity-investment-scheme" element={<CapacityInvestmentSchemeAnalytics />} />
              <Route path="/demand-flexibility-market" element={<DemandFlexibilityMarketAnalytics />} />
              <Route path="/energy-asset-life-extension" element={<EnergyAssetLifeExtensionAnalytics />} />
              <Route path="/green-ammonia-export" element={<GreenAmmoniaExportAnalytics />} />
              <Route path="/electricity-export-cable" element={<ElectricityExportCableAnalytics />} />
              <Route path="/industrial-decarbonisation" element={<IndustrialDecarbonisationAnalytics />} />
              <Route path="/community-energy-storage" element={<CommunityEnergyStorageAnalytics />} />
              <Route path="/nem-generation-mix" element={<NEMGenerationMixAnalytics />} />
              <Route path="/consumer-energy-affordability" element={<ConsumerEnergyAffordabilityAnalytics />} />
              <Route path="/electricity-price-risk" element={<ElectricityPriceRiskAnalytics />} />
              <Route path="/ev-fleet-depot"    element={<EVFleetDepotAnalytics />}          />
              <Route path="/wind-farm-wake"    element={<WindFarmWakeAnalytics />}          />
              <Route path="/market-bidding-strategy" element={<MarketBiddingStrategyAnalytics />} />
              <Route path="/solar-pv-soiling"  element={<SolarPVSoilingAnalytics />} />
              <Route path="/ot-ics-cyber-security" element={<OTICSCyberSecurityAnalytics />} />
              <Route path="/stpasa-adequacy" element={<STPASAAdequacyAnalytics />} />
              <Route path="/generator-performance-standards" element={<GeneratorPerformanceStandardsAnalytics />} />
              <Route path="/biomass-bioenergy" element={<BiomassBioenergyAnalytics />} />
              <Route path="/electricity-frequency-performance" element={<ElectricityFrequencyPerformanceAnalytics />} />
              <Route path="/lgc-market"                      element={<LGCMarketAnalytics />}                       />
              <Route path="/wave-tidal-ocean" element={<WaveTidalOceanAnalytics />} />
              <Route path="/reactive-power-voltage" element={<ReactivePowerVoltageAnalytics />} />
              <Route path="/battery-revenue-stack" element={<BatteryRevenueStackAnalytics />} />
              <Route path="/digital-energy-twin" element={<DigitalEnergyTwinAnalytics />} />
              <Route path="/network-protection-system" element={<NetworkProtectionSystemAnalytics />} />
              <Route path="/pumped-hydro-dispatch" element={<PumpedHydroDispatchAnalytics />} />
              <Route path="/retail-market-design" element={<RetailMarketDesignAnalytics />} />
              <Route path="/spot-market-depth-x" element={<SpotMarketDepthXAnalytics />} />
              <Route path="/solar-farm-operations" element={<SolarFarmOperationsAnalytics />} />
              <Route path="/distribution-network-planning" element={<DistributionNetworkPlanningAnalytics />} />
              <Route path="/grid-flexibility-services" element={<GridFlexibilityServicesAnalytics />} />
              <Route path="/hydrogen-refuelling-station" element={<HydrogenRefuellingStationAnalytics />} />
              <Route path="/offshore-wind-finance"       element={<OffshoreWindFinanceAnalytics />}       />
              <Route path="/carbon-offset-project"     element={<CarbonOffsetProjectAnalytics />}      />
              <Route path="/power-grid-climate-resilience" element={<PowerGridClimateResilienceAnalytics />} />
              <Route path="/energy-storage-tech-comparison" element={<EnergyStorageTechComparisonAnalytics />} />
              <Route path="/power-to-x-economics" element={<PowerToXEconomicsAnalytics />} />
              <Route path="/electricity-market-microstructure" element={<ElectricityMarketMicrostructureAnalytics />} />
              <Route path="/grid-decarbonisation-pathway" element={<GridDecarbonisationPathwayAnalytics />} />
              <Route path="/rooftop-solar-network-impact" element={<RooftopSolarNetworkImpactAnalytics />} />
              <Route path="/electricity-network-tariff-reform" element={<ElectricityNetworkTariffReformAnalytics />} />
              <Route path="/long-duration-energy-storage" element={<LongDurationEnergyStorageAnalytics />} />
              <Route path="/hydrogen-pipeline-infrastructure" element={<HydrogenPipelineInfrastructureAnalytics />} />
              <Route path="/carbon-capture-storage-project"  element={<CarbonCaptureStorageProjectAnalytics />}  />
              <Route path="/energy-poverty-vulnerable-consumer" element={<EnergyPovertyVulnerableConsumerAnalytics />} />
              <Route path="/nuclear-small-modular-reactor" element={<NuclearSmallModularReactorAnalytics />} />
              <Route path="/electricity-market-transparency" element={<ElectricityMarketTransparencyAnalytics />} />
              <Route path="/geothermal-energy-development" element={<GeothermalEnergyDevelopmentAnalytics />} />
              <Route path="/solar-thermal-power-plant" element={<SolarThermalPowerPlantAnalytics />} />
              <Route path="/energy-trading-algorithmic-strategy" element={<EnergyTradingAlgorithmicStrategyAnalytics />} />
              <Route path="/ev-grid-integration-v2g" element={<EVGridIntegrationV2GAnalytics />} />
              <Route path="/biomethane-gas-grid-injection" element={<BiomethaneGasGridInjectionAnalytics />} />
              <Route path="/electricity-market-forecasting-accuracy" element={<ElectricityMarketForecastingAccuracyAnalytics />} />
              <Route path="/national-energy-transition-investment" element={<NationalEnergyTransitionInvestmentAnalytics />} />
              <Route path="/electricity-spot-price-seasonality" element={<ElectricitySpotPriceSeasonalityAnalytics />} />
              <Route path="/grid-congestion-constraint" element={<GridCongestionConstraintAnalytics />} />
              <Route path="/electricity-market-competition-concentration" element={<ElectricityMarketCompetitionConcentrationAnalytics />} />
              <Route path="/renewable-energy-zone-development" element={<RenewableEnergyZoneDevelopmentAnalytics />} />
              <Route path="/battery-storage-degradation-lifetime" element={<BatteryStorageDegradationLifetimeAnalytics />} />
              <Route path="/electricity-consumer-switching-churn" element={<ElectricityConsumerSwitchingChurnAnalytics />} />
              <Route path="/nem-inertia-synchronous-condenser" element={<NEMInertiaSynchronousCondenserAnalytics />} />
              <Route path="/offshore-wind-leasing-site" element={<OffshoreWindLeasingSiteAnalytics />} />
              <Route path="/electricity-market-regulatory-appeals" element={<ElectricityMarketRegulatoryAppealsAnalytics />} />
              <Route path="/distributed-energy-resource-management" element={<DistributedEnergyResourceManagementAnalytics />} />
              <Route path="/market-price-formation-review" element={<MarketPriceFormationReviewAnalytics />} />
              <Route path="/residential-solar-self-consumption" element={<ResidentialSolarSelfConsumptionAnalytics />} />
              <Route path="/energy-infrastructure-cyber-threat" element={<EnergyInfrastructureCyberThreatAnalytics />} />
              <Route path="/wholesale-gas-market" element={<WholesaleGasMarketAnalytics />} />
              <Route path="/electricity-demand-forecasting-ml" element={<ElectricityDemandForecastingMLAnalytics />} />
              <Route path="/settings"          element={<Settings />}            />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
