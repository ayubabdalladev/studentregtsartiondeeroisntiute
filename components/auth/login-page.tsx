"use client"

import type React from "react"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface LoginPageProps {
  onLogin: (role: "ADMIN" | "TEACHER") => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post<{ role: "ADMIN" | "TEACHER" }>("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      onLogin(res.data.role)
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error?.response?.data?.message ?? "Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left Side - Login Image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-0 relative overflow-hidden">
        <img 
          src="/loginimage.jpg" 
          alt="Login Visual" 
          className="w-full h-full object-cover object-center" 
          style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden mb-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">School Management</h1>
          </div>

          <Card className="p-8 sm:p-10 shadow-xl border-0">
            <div className="mb-8">
              <h1 className="hidden lg:block text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h1>
              <p className="text-slate-600 dark:text-slate-400">Sign in to your school account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                <Label htmlFor="remember" className="text-slate-600 dark:text-slate-400 cursor-pointer text-sm">
                  Remember me
                </Label>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                </p>
              </div>
            </div>
          </Card>

          {/* Footer */}
          <p className="text-center text-slate-600 dark:text-slate-400 text-sm mt-6">
            Need help?{" "}
            <button className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Contact Support</button>
          </p>
        </div>
      </div>
    </div>
  )
}
