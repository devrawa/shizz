// fetchguard is a read-only, bounded public-web fetcher, not a port scanner.
package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"time"
)

const maxBytes = 1500000

var blocked = []string{
	"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
	"172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "192.88.99.0/24",
	"198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
	"::/96", "::ffff:0:0/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/23",
	"2001:db8::/32", "2002::/16", "fc00::/7", "fe80::/10", "ff00::/8", "3fff::/20",
}

func publicIP(ip netip.Addr) bool {
	if !ip.IsValid() || ip.Is4In6() || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
		return false
	}
	for _, cidr := range blocked {
		if netip.MustParsePrefix(cidr).Contains(ip) {
			return false
		}
	}
	return true
}

func validateURL(raw string) (*url.URL, error) {
	if strings.ContainsAny(raw, "\\\r\n\t ") {
		return nil, errors.New("invalid URL characters")
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" || u.User != nil {
		return nil, errors.New("only HTTP(S) without credentials")
	}
	p := u.Port()
	if p != "" && !((u.Scheme == "https" && p == "443") || (u.Scheme == "http" && p == "80")) {
		return nil, errors.New("non-standard port blocked")
	}
	host := strings.ToLower(u.Hostname())
	if strings.Contains(host, "%") || host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return nil, errors.New("local target blocked")
	}
	u.Fragment = ""
	return u, nil
}

// DNS is resolved and validated inside DialContext; the socket uses the literal validated IP.
func pinnedDial(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(ips) == 0 {
		return nil, errors.New("DNS lookup failed")
	}
	for _, ip := range ips {
		if !publicIP(ip) {
			return nil, errors.New("private/reserved address blocked")
		}
	}
	d := net.Dialer{Timeout: 8 * time.Second}
	return d.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
}

type Result struct {
	URL     string            `json:"url"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

func fetch(raw string, follow bool) (Result, error) {
	u, err := validateURL(raw)
	if err != nil {
		return Result{}, err
	}
	tr := &http.Transport{Proxy: nil, DialContext: pinnedDial, TLSHandshakeTimeout: 8 * time.Second,
		DisableCompression: true, DisableKeepAlives: true, TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}}
	defer tr.CloseIdleConnections()
	c := http.Client{Transport: tr, Timeout: 20 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if !follow {
			return http.ErrUseLastResponse
		}
		if len(via) >= 4 {
			return errors.New("redirect limit")
		}
		_, e := validateURL(req.URL.String())
		return e
	}}
	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("User-Agent", "shizz-ai-agent/0.1 read-only-research")
	req.Header.Set("Accept-Encoding", "identity")
	resp, err := c.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer resp.Body.Close()
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if !(strings.HasPrefix(contentType, "text/") || strings.HasPrefix(contentType, "application/json") || strings.HasPrefix(contentType, "application/xhtml+xml")) {
		return Result{}, errors.New("text pages only")
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil || len(body) > maxBytes {
		return Result{}, errors.New("page size/read limit")
	}
	h := map[string]string{}
	for k, v := range resp.Header {
		h[strings.ToLower(k)] = strings.Join(v, ", ")
	}
	return Result{resp.Request.URL.String(), resp.StatusCode, h, string(body)}, nil
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: fetchguard URL follow|nofollow")
		os.Exit(2)
	}
	result, err := fetch(os.Args[1], os.Args[2] == "follow")
	if err != nil {
		fmt.Fprintln(os.Stderr, "public page unavailable or blocked")
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		os.Exit(1)
	}
}
