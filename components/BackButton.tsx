"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BackButtonProps {
  href?: string
}

export function BackButton({ href }: BackButtonProps) {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => (href ? router.push(href) : router.back())}
      className="-ml-2 text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="mr-1 size-4" />
      Retour
    </Button>
  )
}
