import type { FinancialDistributionOutput } from "@openmonetis/validators/financial-distribution";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  downloadFinancialDistributionCsv,
  downloadSvgAsPng,
} from "./financial-distribution.presentation";

export function useExportFinancialDistributionMutation() {
  return useMutation({
    mutationFn: async (report: FinancialDistributionOutput) =>
      downloadFinancialDistributionCsv(report),
    onSuccess: () => toast.success("Relatório exportado."),
    onError: () => toast.error("Não foi possível exportar o relatório."),
  });
}

export function useExportFinancialDistributionImageMutation() {
  return useMutation({
    mutationFn: async (input: { svg: SVGSVGElement; filename: string }) =>
      downloadSvgAsPng(input.svg, input.filename),
    onSuccess: () => toast.success("Imagem do gráfico exportada."),
    onError: () => toast.error("Não foi possível exportar a imagem do gráfico."),
  });
}
