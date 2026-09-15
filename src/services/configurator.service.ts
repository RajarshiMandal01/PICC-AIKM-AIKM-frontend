import { BuildingBlock } from "@/shared/types/building-block";
import ApiService from "./api.service";

const CONFIGURATOR_URL = import.meta.env.VITE_PROGRAMADO_CONFIGURATOR_BASE_URL as string;

const GET_BB = CONFIGURATOR_URL + '/lcncconfig/bb/getBB';
export const ConfiguratorService = {
    getBB: () => ApiService.get<BuildingBlock[]>(`${GET_BB}`),
}
